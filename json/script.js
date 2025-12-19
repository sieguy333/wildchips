/* Configuration de l'API */

const API_URL = "https://wildchips.onrender.com/api";

let loginSound;
let genreClickSound;


/* Initialisation */
document.addEventListener('DOMContentLoaded', () => {
    loginSound = document.getElementById('login-sound');
    genreClickSound = document.getElementById('genre-click-sound');
    /* Événements globaux */
    document.getElementById('login-btn').addEventListener('click', handleLogin);
    document.getElementById('signup-btn').addEventListener('click', handleSignup);
    document.getElementById('restart-btn').addEventListener('click', restartApp);
    document.getElementById('logout-btn').addEventListener('click', handleLogout);
    document.getElementById('search-btn').addEventListener('click', performSearch);
    document.getElementById('search-input').addEventListener('keypress', function (e) {if (e.key === 'Enter') performSearch();});

    /* Démarrer l'intro */
    setTimeout(() => {
        triggerCutAnimation(() => {
            document.getElementById('intro-screen').classList.add('hidden');
            document.getElementById('login-screen').classList.remove('hidden');
        });
    }, 2500);
});

/* système de recherche API */

async function performSearch() {
    const query = document.getElementById('search-input').value;
    if (!query) return;

    console.log("1. Tentative de recherche lancée pour:", query);
    currentMoviesCache = {};

    try {
        const response = await fetch(`${API_URL}/search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: query })
        });

        if (!response.ok) {
            /* Si le serveur répond avec 400, 500, etc. */
            console.error("Erreur HTTP:", response.status, response.statusText);
            alert(`Erreur du serveur (Statut: ${response.status}). Vérifiez le terminal Python.`);
            return;
        }

        const data = await response.json();
        console.log("3. Données JSON reçues:", data);

        if (data.status === "not_found") {
            alert(data.message);
        } else if (data.status === "multiple") {
            /* Afficher les choix */
            showCandidates(data.candidates);
        } else if (data.status === "exact") {
            /* Un seul résultat, on lance la reco direct */
            getRecommendations(data.id);
        }
    } catch (error) {
        console.error("Erreur API:", error);
        alert("Erreur de connexion au serveur Python.");
    }
}

/* Fonction qui affiche la liste des films si le choix de l'utilisateur est flou */

function showCandidates(candidates) {
    const area = document.getElementById('disambiguation-area');
    const list = document.getElementById('candidates-list');
    
    area.classList.remove('hidden');
    list.innerHTML = '';

    candidates.forEach(film => {
        const titleToDisplay = film.movie_title_fr;
        const title = titleToDisplay || film.titre_fr_capitalize;
        /* Pour chaque candidat, on crée un bouton */
        const btn = document.createElement('button');
        btn.className = 'btn btn-skip'; 
        btn.innerHTML = `${title} <br><small>(${film.released_year})</small>`;
        btn.onclick = () => {
            getRecommendations(film.index_id);
        }
        list.appendChild(btn);
    });
}

/* Logique de recommandation API */

async function getRecommendations(filmId) {
    /*On masque la recherche et on affiche un chargement si besoin */
    document.getElementById('search-container').classList.add('hidden');

    /* Gestion des potentielles erreurs */
    if (filmId === null || filmId === undefined) {
    console.error("ID de film manquant pour la recommandation.");
    alert("Impossible de lancer la recommandation pour ce film.");
    return;
}
    
    try {
        const response = await fetch(`${API_URL}/recommend`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: filmId })
        });
        const data = await response.json();

        displayResults(data);

    } catch (error) {
        console.error("Erreur Reco:", error);
    }
}

function displayResults(data) {

    document.getElementById('results-grid').classList.remove('hidden');

    const grid = document.getElementById('results-grid');
    const actions = document.getElementById('action-buttons');
    const restartBtn = document.getElementById('restart-btn');

    actions.classList.remove('hidden');
    
    grid.classList.remove('hidden');
    actions.classList.remove('hidden');
    restartBtn.classList.remove('hidden');
    grid.innerHTML = '';

    /* 1. Film référence */
    /* Sauvegarde du film de référence dans le cache (pour l'affichage détails)
     On utilise un ID fictif 'ref' ou on génère un ID unique si l'API ne le renvoie pas ici
     Pour simplifier, on affiche juste le titre ici. */
    grid.innerHTML += `<div class="para"><h2 class = "titre_reco">TA REFERENCE : ${data.reference.movie_title_fr}</h2></div>`;

    /* Fonction helper pour générer le HTML d'une section */
    const addSection = (title, movies) => {
        if (!movies || movies.length === 0) return;
        grid.innerHTML += `<div class="para" style="margin-top: 30px;"><h3 class = "titre_reco">${title}</h3></div>`;
        movies.forEach((m, index) => {
            /* On stocke le film dans notre variable globale pour pouvoir afficher les détails plus tard
             On utilise une clé unique, ici on va utiliser "titre + année" ou un ID généré si dispo
             Comme on n'a pas forcément d'ID unique propre dans la réponse JSON pour chaque reco, 
             on va tricher un peu en ajoutant une propriété ID temporaire à l'objet m. */
            const tempId = title.substring(0,3) + index; 
            m.tempId = tempId;
            currentMoviesCache[tempId] = m;

            grid.innerHTML += createMovieCard(m);
        });
    };

    addSection("RECOMMANDATIONS GLOBALES", data.global);
    addSection("DANS LE MEME GENRE", data.genre);
    addSection("AVEC LA MEME ACTRICE / LE MEME ACTEUR", data.actor);
    addSection("PAR LE MEME REALISATEUR", data.director);
}

/* Gestion de l'animation de coupe */

function triggerCutAnimation(callback) {
    const overlay = document.getElementById('cut-overlay');
    
    /* Reset */
    overlay.classList.remove('hidden');
    overlay.classList.remove('curtains-open');
    overlay.classList.add('curtains-closed');
    
    setTimeout(() => {
        /* Changement de contenu derrière le rideau */
        if (callback) callback();

        /* Flash épée */
        overlay.classList.add('slashing');

        /* Ouverture */
        setTimeout(() => {
            overlay.classList.remove('slashing');
            overlay.classList.remove('curtains-closed');
            overlay.classList.add('curtains-open');
        }, 400);
    }, 600);
}

/* Système de navigation, d'identification */

function handleLogin() {

    /* Récupération et traitement des données entrées par l'utilisateur */

    const emailInput = document.getElementById('email-input');
    const passwordInput = document.getElementById('password-input');
    
    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();

    /* S'assurer que les deux champs sont remplis */
    if (email === '' || password === '') {
        alert("Veuillez saisir votre adresse email et votre mot de passe pour vous identifier.");
        return;
    }

    /* Vérification du format email (très basique) */
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/; 
    if (!emailRegex.test(email)) {
        alert("Veuillez saisir une adresse email valide.");
        return; 
    }

    if (loginSound) {
        /* Optionnel : Remet le son au début au cas où il aurait été joué récemment */
        loginSound.currentTime = 0; 
        loginSound.play();
    }

    triggerCutAnimation(() => {
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('app-screen').classList.remove('hidden');
        document.getElementById('search-container').classList.remove('hidden');
    });
}

/* Fonctions de simulation de création de compte */
/* Formulaire de création de compte */

function renderSignupForm() {
    const signupScreen = document.getElementById('signup-screen');
    signupScreen.innerHTML = `
        <div id="login-screen">
            <div class="login-left">
                <h1 class="titre">Création de compte</h1>
                
                <div id="signup-form-message" style="color: red; margin-bottom: 15px;"></div>

                <div class="input-group">
                    <input type="text" placeholder="Nom (Obligatoire)" id="signup-nom">
                </div>
                <div class="input-group">
                    <input type="text" placeholder="Prénom (Obligatoire)" id="signup-prenom">
                </div>
                <div class="input-group">
                    <input type="email" placeholder="Email (Obligatoire)" id="signup-email">
                </div>
                <div class="input-group">
                    <input type="password" placeholder="Mot de passe (Obligatoire)" id="signup-password">
                </div>
                <div class="input-group">
                    <input type="password" placeholder="Âge" id="signup-age">
                </div>

                <button class="btn" onclick="submitSignupSimulation()">Valider l'inscription</button>
                <button class="btn btn-skip" onclick="cancelSignup()">← Annuler</button>
            </div>
            <div class="login-right">
                <div class="logo logo-floating"><img src="img/logo_wildflix.png" alt=""></div>
            </div>
        </div>    
    `;
    signupScreen.classList.remove('hidden');
}

function handleSignup() {
    document.getElementById('login-screen').classList.add('hidden');
    
    /* Afficher le formulaire d'inscription dynamique */
    renderSignupForm();
}

/* Fonction de vérification et de soumission du formulaire d'inscription */

function submitSignupSimulation() {
    const nom = document.getElementById('signup-nom').value.trim();
    const prenom = document.getElementById('signup-prenom').value.trim();
    const email = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value.trim();
    const age = document.getElementById('signup-age').value.trim(); // Non obligatoire, mais bon à vérifier
    const messageArea = document.getElementById('signup-form-message');

    /* Vérification des champs obligatoires */
    if (!nom || !prenom || !email || !password) {
        messageArea.style.color = "#fa89e1";
        messageArea.textContent = "Veuillez remplir tous les champs obligatoires (Nom, Prénom, Email, Mot de passe).";
        return;
    }
    
    /* Afficher le message de succès dans la zone de message */
    messageArea.style.color = "#fa89e1";
    messageArea.textContent = `Compte créé pour ${prenom} ${nom} ! Vous allez être redirigé vers l'écran de connexion.`;

    /* Lancer la transition après un court délai */
    setTimeout(() => {
        document.getElementById('signup-screen').classList.add('hidden');
        document.getElementById('login-screen').classList.remove('hidden');
        
        // Optionnel : Effacer les champs de connexion précédents
        document.getElementById('email-input').value = email; /* Pré-remplir l'email */
        document.getElementById('password-input').value = '';
    }, 2000);

}

/* Fonction pour annuler l'inscription et retourner au login */
function cancelSignup() {
    document.getElementById('signup-screen').classList.add('hidden');
    document.getElementById('login-screen').classList.remove('hidden');
}


/* Système de cartes pour les films */


function createMovieCard(movie) {

    return `
        <div class="movie-card" onclick="showMovieDetails('${movie.tempId}')">
            <div class="movie-placeholder"><img src = "${movie.image}" alt=""></div>
            <h3>${movie.movie_title_fr || movie.movie_title}</h3>
            <p>${movie.genres}</p>
            <p style="font-size: 0.8rem; color: #fa89e1;">${movie.released_year}</p>
            <p class="movie-actor">${movie.ces_bons_vieux_acteurs}</p>
        </div>
    `;
}

function restartApp() {
   
    /* Reset UI */
    document.getElementById('results-grid').classList.add('hidden');       
    document.getElementById('restart-btn').classList.add('hidden');        
    document.getElementById('action-buttons').classList.add('hidden');
    document.getElementById('disambiguation-area').classList.add('hidden');
    document.getElementById('movie-details-screen').classList.add('hidden');

    /* Reset Input */
    document.getElementById('search-input').value = '';
    
    /* Afficher la recherche */
    document.getElementById('search-container').classList.remove('hidden');
}

function handleLogout() {
    
    /* 2. Nettoyer les champs de formulaire (optionnel mais propre) */
    document.getElementById('email-input').value = '';
    document.getElementById('password-input').value = '';
    document.getElementById('search-input').value = '';

    /* 3. Masquer l'App et Réafficher le Login */
    /* On utilise l'animation de coupe pour faire une transition fluide vers la sortie */
    triggerCutAnimation(() => {
        document.getElementById('app-screen').classList.add('hidden');
        document.getElementById('action-buttons').classList.add('hidden'); // Sécurité
        document.getElementById('results-grid').classList.add('hidden');

        /* Reset l'état interne de l'app screen */
        document.getElementById('search-container').classList.remove('hidden');
        document.getElementById('disambiguation-area').classList.add('hidden');
    
        /* Afficher l'écran de login */
        document.getElementById('login-screen').classList.remove('hidden');
    });
}

function showMovieDetails(tempId) {
    const movie = currentMoviesCache[tempId]; 

    if (!movie) {
        console.error("Film non trouvé dans le cache!");
        return;
    }

    /* On enlève les espaces avant et après la chaine de caractère si il y en a
    Normalement non mais on ne sait jamais ! */
    const baRaw = (movie.bande_annonce && typeof movie.bande_annonce === 'string') ? movie.bande_annonce : '';
    const baBrute = baRaw.trim();
           
    let baContent = '';

    /* On met tout en minuscule par précaution (même si c'est déjà le cas) 
    On crée un bouton qui renvoie vers la page you tube de la bande annonce du film*/
    if (baBrute && baBrute.toLowerCase() !== 'unknown') { 
        baContent = `
            <div class="details-actions" style="margin-top: 20px;">
                <a href="${baBrute}" target="_blank" class="btn btn-primary">
                    Bande annonce
                </a>
            </div>
        `;
    /* Si la bande annonce est indisponible on affiche un message dans le bouton
    qui devient non cliquable*/    
    } else {
         baContent = `
            <div class="details-actions">
                <button class="btn btn-disabled" disabled>Bande-annonce non disponible</button>
            </div>
         `;
    }
    
    
    const detailsHTML = `
        <button id="back-btn" class="btn btn-skip" onclick="hideMovieDetails()">
            ← Retour aux résultats
        </button>
        <div class="details-content">
            <div class="details-poster"><img src="${movie.image}" alt=""></div>
            <div class="details-info">
                <h2>${movie.movie_title_fr || movie.movie_title} (${movie.released_year})</h2>
                <p><strong>Genre:</strong> ${movie.genres}</p>
                <p>${movie.durex}</p>
                <p><strong>Réalisé par:</strong> ${movie.serial_realisator}</p>
                <p><strong>Acteurs principaux:</strong> ${movie.ces_bons_vieux_acteurs}</p>
                
                <h3 class="synopsis-title">Synopsis</h3>
                <p class="synopsis-text">${movie.plot}</p>

                ${baContent} 

            </div>
        </div>
    `;

    document.getElementById('results-grid').classList.add('hidden');
    document.getElementById('action-buttons').classList.add('hidden');
    
    const detailsContainer = document.getElementById('movie-details-screen');
    detailsContainer.innerHTML = detailsHTML;
    detailsContainer.classList.remove('hidden');
}

/* Fonction pour revenir à la grille de résultats */
function hideMovieDetails() {
    document.getElementById('movie-details-screen').classList.add('hidden');
    document.getElementById('results-grid').classList.remove('hidden');
    document.getElementById('action-buttons').classList.remove('hidden');

}



