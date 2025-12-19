from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
from sklearn.metrics.pairwise import cosine_similarity

app = Flask(__name__)
CORS(app)  # Permet au site web de "parler" au serveur

print("Chargement des données en cours... (ça peut prendre quelques secondes)")

# On charge toutes les données:
try:
    df = pd.read_csv("backend_reco/df_normal_final.csv")
    df_2 = pd.read_csv("backend_reco/df_archi_complet.csv")
    df_genres = pd.read_csv("backend_reco/df_genres.csv")
    df_acteurs = pd.read_csv("backend_reco/df_acteurs.csv")
    df_reals = pd.read_csv("backend_reco/df_reals.csv")

    # On pré-calcule les matrices ici pour ne pas le faire à chaque requête
    matrice_similarite = cosine_similarity(df)
    df_similarite = pd.DataFrame(matrice_similarite, index=df.index, columns=df.index)

    # matrice_similarite_genres = cosine_similarity(df_genres)
    # df_similarite_genres = pd.DataFrame(matrice_similarite_genres, index=df.index, columns=df.index)
    
    # Note : On s'assure que l'index est accessible
    df_2 = df_2.reset_index(drop=True) 
    
    print("Données chargées avec succès !")
except Exception as e:
    print(f"ERREUR CRITIQUE DE CHARGEMENT : {e}")


# Recherche du film entré par l'utilisateur:

@app.route('/api/search', methods=['POST'])

def search_film():
    data = request.json
    user_input = data.get('query', '')

    # On nettoie et on filtre les données utilisateur pour ne pas avoir de conflit
    # entre les données de notre dataframe et celles de l'utilisateur
    entre_utilisateur = user_input.capitalize()
    entre_utilisateur_list = entre_utilisateur.split(sep=" ")
    
    filtre_final = pd.Series(True, index=df_2.index)

    for mot in entre_utilisateur_list:
        # Utilisation de na=False pour éviter les crashs sur des valeurs vides
        # Principe de précaution parce que nous n'avons pas de valeurs vides 
        # (Parce que j'ai bien nettoyé mon dataframe avant !)
        filtre_mot = df_2["titre_fr_capitalize"].str.contains(mot, na=False)
        filtre_final = filtre_final & filtre_mot

    resultats = df_2[filtre_final]

    if resultats.empty:
        return jsonify({"status": "not_found", "message": "Aucun film trouvé, reformulez votre demande."})
    
    elif len(resultats) > 1:
        # On crée directement une copie avec toutes les colonnes nécessaires
        candidates = resultats.loc[:, ['movie_title_fr', 'released_year', 'titre_fr_capitalize']].copy()
        
        # Ajouter la colonne 'index_id' en garantissant que l'objet est une copie
        candidates.loc[:, 'index_id'] = resultats.index
        return jsonify({
            "status": "multiple", 
            "candidates": candidates.to_dict(orient='records')
        })
    
    else:
        # Un seul film trouvé, on renvoie directement son ID
        film_unique = resultats.iloc[0]
        film_id = int(resultats.index[0])
        print(f"RECHERCHE EXACTE : ID trouvé = {film_id}, Titre = {film_unique['movie_title_fr'] or film_unique['movie_title']}")
        return jsonify({
            "status": "exact", 
            "id": int(resultats.index[0]),  # L'index Pandas du film
            "title": film_unique['titre_fr_capitalize']
        })

# Mise en place de la recommandation:

@app.route('/api/recommend', methods=['POST'])

def reco():
    try:
        data = request.json
        print(f"JSON REÇU : {data}")
        idx = data.get('id') # On récupère l'ID du film validé

        if idx is None:
            return jsonify({"error": "ID manquant"}), 400
        
        # Conversion de l'index en entier
        try:
            idx = int(idx)
        except ValueError:
            print(f"ERREUR: ID reçu n'est pas un entier: {idx}")
            return jsonify({"error": f"ID non numérique reçu: {idx}"}), 400

        # Vérification de l'index dans les DataFrames de similarité?
        if idx not in df_similarite.index:
            print(f"ERREUR: ID {idx} n'existe pas dans la matrice de similarité.")
            return jsonify({"error": f"Le film avec l'ID {idx} est introuvable pour la recommandation."}), 404
        
        # Colonnes à renvoyer au front
        colonnes_a_afficher = ["movie_title_fr", 
                "movie_title", 
                "genres", 
                "serial_realisator", 
                "ces_bons_vieux_acteurs", 
                "released_year", 
                "imdb_score", 
                "plot",
                "image",
                "bande_annonce",
                "durex"]
        
        # Recommandation globale:

        score_film_utilisateur = df_similarite.iloc[idx]
        index_films_recommandes = score_film_utilisateur.sort_values(ascending=False).head(6).index 
        index_5_films_reco = index_films_recommandes[1:]
        films_recommandes = df_2.iloc[index_5_films_reco][colonnes_a_afficher]

        # Recommandation par genre:

        film_ref = df_2.iloc[idx]
        liste_genres = film_ref["genres"].split('|')
        
        g1 = liste_genres[0]
        # On cherche les films qui contiennent g1
        condition = df_2['genres'].str.contains(g1, na=False)
        
        # Si un deuxième genre existe, on ajoute la condition ET g2
        if len(liste_genres) > 1:
            g2 = liste_genres[1]
            condition = condition & df_2['genres'].str.contains(g2, na=False)
        
        # On applique le filtre (en excluant le film de référence)
        genres_recommandes = df_2[condition & (df_2.index != idx)].sort_values(by='imdb_score', ascending=False).head(5)
        
        
        # Si les deux genres sont trop rares et ne donnent rien, on se rabat sur le premier genre seul
        if genres_recommandes.empty:
            genres_recommandes = df_2[
                (df_2['genres'].str.contains(g1, na=False)) & (df_2.index != idx)
            ].sort_values(by='imdb_score', ascending=False).head(5)
        
        # Recommandation par acteur:

        acteurs_film_utilisateur = df_acteurs.iloc[idx]
        acteurs_f_reco = acteurs_film_utilisateur[acteurs_film_utilisateur == 1].index.tolist()

        if acteurs_f_reco:    # cette ligne de code est un raccourci pour dire : "if len(acteurs_f_reco) > 0:", c'est pour savoir si une liste est vide ou pas
            acteurs_princip = acteurs_f_reco[0]
            reco_acteurs_5 = df_2[(df_2["ces_bons_vieux_acteurs"].str.contains(acteurs_princip)) & (df_2.index != idx)].sample(5)
            reco_acteurs = reco_acteurs_5[colonnes_a_afficher]

        else:
            reco_acteurs = pd.DataFrame()

        # Recommandation par realisateur

        real_film_utilisateur = df_reals.iloc[idx]   
        liste_real_f_reco = real_film_utilisateur[real_film_utilisateur == 1].index.tolist()

        if liste_real_f_reco:   
            real_f = liste_real_f_reco[0]
            reco_reals_5 = df_2[(df_2["serial_realisator"].str.contains(real_f, case=False)) & (df_2.index != idx)].sample(5)
            reco_reals = reco_reals_5[colonnes_a_afficher]
        else:
            reco_reals = pd.DataFrame()

        ref_film = df_2.iloc[idx][colonnes_a_afficher].to_dict()

        return jsonify({
            "reference": ref_film,
            "global": films_recommandes.to_dict(orient='records'),
            "genre": genres_recommandes.to_dict(orient='records'),
            "actor": reco_acteurs.to_dict(orient='records') if not reco_acteurs.empty else [],
            "director": reco_reals.to_dict(orient='records') if not reco_reals.empty else []
        })

    except Exception as e:
        # En cas d'erreur (division par zéro, donnée manquante, etc.)
        print(f"ERREUR MAJEURE PENDANT LE CALCUL DE RECO POUR ID {idx} : {e}")
        return jsonify({"error": f"Erreur interne lors du calcul. Vérifiez les données pour le film {idx}."}), 500

if __name__ == '__main__':

    app.run(debug=True, port=5000)


