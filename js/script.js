// --- Variáveis Globais e Referências DOM (mantidas como antes) ---
const gameContainer = document.getElementById('game-container');
const enemiesContainer = document.getElementById('enemies-container');
const player = document.getElementById('player');
const typingInput = document.getElementById('typing-input');
const scoreDisplay = document.getElementById('score');
const messageBoard = document.getElementById('message-board');
const startMenu = document.getElementById('start-menu');
const pauseMenu = document.getElementById('pause-menu');
const startButton = document.getElementById('start-button');
const resumeButton = document.getElementById('resume-button');
const pauseButton = document.getElementById('pause-button');
const usernameInput = document.getElementById('username-input');
const displayUsername = document.getElementById('display-username');
const startUsernameDisplay = document.getElementById('start-username-display');
const usernameError = document.getElementById('username-error');
const gameInfo = document.getElementById('game-info');

const projectileSpeedMs = 120;

let currentUsername = null;
const highScoresKey = 'typingGameHighScores';
const usernameKey = 'typingGameUser';

const wordList = [ /* ... (mesma lista de antes) ... */
    "html", "css", "body", "head", "div", "span", "link", "script",
    "style", "class", "id", "img", "src", "alt", "href", "const", "let",
    "var", "function", "return", "if", "else", "for", "while", "true",
    "false", "null", "array", "object", "color", "width", "height", "margin",
    "padding", "border", "flex", "grid", "position", "absolute", "relative",
    "fixed", "align", "justify", "font", "text", "event", "click", "key",
    "value", "document", "window", "alert", "prompt", "console", "log"
];

let score = 0;
let enemies = [];
let gameInterval = null;
let spawnInterval = null;
let activeTarget = null;
let gameState = 'menu'; // 'menu', 'playing', 'paused', 'gameOver'


const enemySpeed = 1.2; // Um pouco mais rápido
const spawnRate = 2200; // Um pouco mais frequente

// --- Funções Principais (com ajustes) ---

function getRandomWord() {
    return wordList[Math.floor(Math.random() * wordList.length)];
}


function createEnemy() {
    if (gameState !== 'playing') return;

    const word = getRandomWord();
    const enemyElement = document.createElement('div');
    enemyElement.classList.add('enemy');
    const wordElement = document.createElement('div');
    wordElement.classList.add('enemy-word');
    // Cria spans para cada letra
    wordElement.innerHTML = word.split('').map(char => `<span>${char}</span>`).join('');
    enemyElement.appendChild(wordElement);

    // Posicionamento (mantido, mas ajusta para nova largura/altura se necessário)
    const enemyWidthEst = word.length * 15 + 30; // Estimativa baseada na fonte mono
    enemyElement.style.width = `${enemyWidthEst}px`;
    const maxX = gameContainer.offsetWidth - enemyWidthEst - 10;
    const randomX = Math.max(10, Math.floor(Math.random() * maxX));
    enemyElement.style.left = `${randomX}px`;
    // Força reflow para obter altura antes de definir 'top'
    enemiesContainer.appendChild(enemyElement);
    const enemyHeight = enemyElement.offsetHeight || 45; // Usa altura real ou fallback
    enemyElement.style.top = `-${enemyHeight}px`;


    const enemyData = {
        element: enemyElement,
        word: word,
        wordSpans: wordElement.querySelectorAll('span'),
        y: -enemyHeight
    };
    enemies.push(enemyData);

    if (!activeTarget) {
        setActiveTarget(enemyData);
    }
}

function setActiveTarget(enemyData) {
    if (gameState !== 'playing' && gameState !== 'paused') return;

    if (activeTarget) {
        activeTarget.element.classList.remove('active-target'); // Usa classe CSS
    }
    activeTarget = enemyData;
    if (activeTarget) {
        activeTarget.element.classList.add('active-target'); // Usa classe CSS
        typingInput.placeholder = `Alvo: ${activeTarget.word}`;
    } else {
        typingInput.placeholder = 'Nenhum alvo...';
    }
    updateTypingFeedback(); // Atualiza feedback imediatamente
}

function findNextTarget() {
    if (gameState !== 'playing') return;
    // Estratégia: alvo mais abaixo (primeiro a ser adicionado que ainda existe)
    setActiveTarget(enemies.length > 0 ? enemies[0] : null);
}

function updateEnemies() {
    if (gameState !== 'playing') return;

    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        enemy.y += enemySpeed;
        enemy.element.style.top = `${enemy.y}px`;

        // Verifica colisão com a "base" (um pouco antes do fundo)
        if (enemy.y + enemy.element.offsetHeight > gameContainer.offsetHeight - 40) {
            gameOver();
            return;
        }
    }
}

function fireShot(targetElement) {
    if (!targetElement || !player) return; // Segurança

    const playerRect = player.getBoundingClientRect();
    const targetRect = targetElement.getBoundingClientRect();
    const containerRect = gameContainer.getBoundingClientRect();

    // Calcula o ponto de partida (ponta da nave) relativo ao container
    const startX = playerRect.left + playerRect.width / 2 - containerRect.left;
    const startY = playerRect.top - containerRect.top; // Perto do topo da nave

    // Calcula o ponto de destino (centro inferior do inimigo) relativo ao container
    const endX = targetRect.left + targetRect.width / 2 - containerRect.left;
    const endY = targetRect.top + targetRect.height - containerRect.top - 5; // Um pouco acima da base

    // Cria o elemento projétil
    const projectile = document.createElement('div');
    projectile.className = 'projectile';

    // Define a posição inicial (precisa ajustar pela metade do tamanho do projétil)
    // Assumindo width=5, height=15
    projectile.style.left = `${startX - 2.5}px`; // startX - width/2
    projectile.style.top = `${startY - 15}px`; // startY - height (para sair da ponta)

    // Adiciona ao container do jogo
    gameContainer.appendChild(projectile);

    // --- Animação ---
    // Força o navegador a aplicar o estilo inicial antes de definir o final
    // Isso garante que a transição CSS funcione.
    requestAnimationFrame(() => {
        // Define a posição final (ajustando pela metade do tamanho do projétil)
        projectile.style.left = `${endX - 2.5}px`;
        projectile.style.top = `${endY}px`; // Chega no ponto calculado

        // Remove o projétil após a animação terminar
        setTimeout(() => {
            // Verifica se o projétil ainda existe no DOM antes de remover
            if (projectile.parentNode) {
                projectile.remove();
            }
        }, projectileSpeedMs);
    });
}

function handleInput(event) {
    if (gameState !== 'playing' || !activeTarget) return;

    const typedValue = event.target.value;
    const targetWord = activeTarget.word;
    const currentLength = typedValue.length;

    updateTypingFeedback(typedValue);

    if (currentLength > 0) { // Só verifica se algo foi digitado
        const lastTypedChar = typedValue[currentLength - 1];
        const targetChar = targetWord[currentLength - 1];

        // Verifica se o índice está dentro da palavra alvo e se o caractere corresponde
        if (currentLength <= targetWord.length && lastTypedChar === targetChar) {
            // --- DISPARA O TIRO AQUI a cada tecla correta ---
            fireShot(activeTarget.element);
            // -----------------------------------------------
        }
    }

    if (typedValue === targetWord) {
        // O tiro para a última letra já foi disparado no bloco acima.
        // Então, processamos a destruição imediatamente.

        score++; // Incrementa score
        scoreDisplay.textContent = score;
        // Efeito visual no score
        scoreDisplay.style.transform = 'scale(1.2)';
        setTimeout(() => { scoreDisplay.style.transform = 'scale(1)'; }, 150);

        destroyEnemy(activeTarget); // Destroi inimigo
        typingInput.value = ''; // Limpa input
        findNextTarget(); // Busca próximo alvo
    }
}

function updateTypingFeedback(typedValue = typingInput.value) {
    if (!activeTarget) return;
    // Não atualiza feedback visual se o jogo acabou ou está no menu
    if (gameState === 'gameOver' || gameState === 'menu') return;

    const targetWord = activeTarget.word;
    const wordSpans = activeTarget.wordSpans;
    let correctSoFar = true;
    let firstIncorrect = -1;

    // Limpa classes de todos os spans primeiro
    wordSpans.forEach(span => span.className = '');

    for (let i = 0; i < targetWord.length; i++) {
        if (i < typedValue.length) {
            if (typedValue[i] === targetWord[i] && correctSoFar) {
                wordSpans[i].classList.add('correct-char');
            } else {
                wordSpans[i].classList.add('incorrect-char');
                correctSoFar = false; // Marca que houve erro
                if (firstIncorrect === -1) firstIncorrect = i; // Guarda índice do primeiro erro
            }
        }
        // Adiciona classe 'next-char' ao próximo caractere esperado se tudo estiver correto até agora
        // e o jogo estiver rodando
        if (gameState === 'playing' && correctSoFar && i === typedValue.length) {
            wordSpans[i].classList.add('next-char');
        }
    }

    // Feedback de tremor apenas se jogando e houver erro
    if (gameState === 'playing') {
        activeTarget.element.style.transform = !correctSoFar ? `translateX(${Math.random() > 0.5 ? '3px' : '-3px'})` : 'translateX(0)';
    } else {
        activeTarget.element.style.transform = 'translateX(0)'; // Reseta se pausado
    }
}

function destroyEnemy(enemyData) {
    enemyData.element.classList.add('explosion'); // Adiciona classe para animar

    // Remove do array de controle imediatamente
    enemies = enemies.filter(e => e !== enemyData);

    // Remove do DOM após a animação
    setTimeout(() => {
        if (enemyData.element.parentNode) {
            enemiesContainer.removeChild(enemyData.element);
        }
    }, 400); // Tempo da animação de explosão (igual à duração no CSS)

    // Verifica se o alvo destruído era o ativo *antes* de buscar o próximo
    const wasActiveTarget = activeTarget === enemyData;
    if (wasActiveTarget) {
        activeTarget = null; // Limpa o alvo explicitamente
        // A busca pelo próximo alvo já ocorre no handleInput após a destruição bem-sucedida
    }
}

// --- Funções de Carregamento e Salvamento de Usuário e Pontuações ---

function loadUser() {
    const savedUser = localStorage.getItem(usernameKey);
    if (savedUser) {
        currentUsername = savedUser;
        usernameInput.value = currentUsername; // Preenche input no menu start
        displayUsername.textContent = currentUsername; // Atualiza display no jogo
        startUsernameDisplay.textContent = currentUsername; // Atualiza display no botão start
        console.log(`Usuário carregado: ${currentUsername}`);
        gameInfo.style.display = 'flex'; // Mostra a barra de info
    } else {
        startUsernameDisplay.textContent = 'Novo Jogador';
        gameInfo.style.display = 'none'; // Esconde barra de info se não há user
        console.log("Nenhum usuário salvo encontrado.");
    }
    usernameError.classList.remove('visible'); // Garante que erro comece escondido
}

function saveUser(username) {
    if (!username || typeof username !== 'string' || username.trim().length === 0) {
        console.error("Tentativa de salvar usuário inválido.");
        return false;
    }
    currentUsername = username.trim();
    localStorage.setItem(usernameKey, currentUsername);
    displayUsername.textContent = currentUsername;
    gameInfo.style.display = 'flex'; // Mostra a barra de info
    console.log(`Usuário salvo: ${currentUsername}`);
    return true;
}

function validateAndSetUsername() {
    const username = usernameInput.value.trim();
    if (username.length === 0) {
        usernameError.textContent = "Por favor, insira um nome de usuário.";
        usernameError.classList.add('visible');
        return false;
    }
    if (username.length > 15) {
        usernameError.textContent = "Usuário muito longo (máx 15 caracteres).";
        usernameError.classList.add('visible');
        return false;
    }
    // Regex simples para evitar apenas espaços ou caracteres muito estranhos (opcional)
    if (!/^[a-zA-Z0-9_\- ]+$/.test(username)) {
        usernameError.textContent = "Use apenas letras, números, _, - ou espaço.";
        usernameError.classList.add('visible');
        return false;
    }

    usernameError.classList.remove('visible');
    return saveUser(username); // Salva e atualiza currentUsername
}

function loadHighScores() {
    try {
        const scoresJson = localStorage.getItem(highScoresKey);
        return scoresJson ? JSON.parse(scoresJson) : {};
    } catch (e) {
        console.error("Erro ao carregar high scores:", e);
        return {}; // Retorna objeto vazio em caso de erro
    }
}

function saveHighScore(username, newScore) {
    if (!username || typeof newScore !== 'number') return;

    const highScores = loadHighScores();
    const currentHighScore = highScores[username] || 0;

    if (newScore > currentHighScore) {
        highScores[username] = newScore;
        try {
            localStorage.setItem(highScoresKey, JSON.stringify(highScores));
            console.log(`Novo recorde para ${username}: ${newScore}`);
            return true; // Indica que foi salvo um novo recorde
        } catch (e) {
            console.error("Erro ao salvar high score:", e);
            return false;
        }
    }
    return false; // Não foi um novo recorde
}

// --- Funções de Controle do Jogo (Ajustadas para usar classes 'active') ---

function pauseGame() {
    if (gameState !== 'playing') return;
    gameState = 'paused';
    console.log("Game Paused");
    clearInterval(gameInterval);
    clearInterval(spawnInterval);
    gameInterval = null;
    spawnInterval = null;

    pauseMenu.classList.add('active'); // Mostra menu de pausa
    typingInput.disabled = true;
    updateTypingFeedback(); // Atualiza para remover 'next-char' etc.
}

function resumeGame() {
    if (gameState !== 'paused') return;
    gameState = 'playing';
    console.log("Game Resumed");

    pauseMenu.classList.remove('active'); // Esconde menu de pausa
    typingInput.disabled = false;
    typingInput.focus();

    // Reinicia loops
    if (!gameInterval) {
        gameInterval = setInterval(gameLoop, 1000 / 60);
    }
    if (!spawnInterval) {
        setTimeout(() => {
            if (gameState === 'playing') {
                spawnInterval = setInterval(createEnemy, spawnRate);
            }
        }, 500);
    }
    updateTypingFeedback(); // Atualiza para mostrar 'next-char'
}

function runGame() {
    console.log("Starting game logic...");
    gameState = 'playing';
    score = 0;
    scoreDisplay.textContent = score;
    enemies = [];
    enemiesContainer.innerHTML = '';
    activeTarget = null;
    messageBoard.classList.remove('active'); // Garante que msg final esteja escondida
    pauseMenu.classList.remove('active');   // Garante que menu pausa esteja escondido
    typingInput.disabled = false;
    typingInput.value = '';
    typingInput.focus();
    typingInput.placeholder = 'Carregando alvo...'; // Placeholder inicial

    // Limpa intervalos antigos
    clearInterval(gameInterval);
    clearInterval(spawnInterval);

    // Inicia loops
    gameInterval = setInterval(gameLoop, 1000 / 60);
    spawnInterval = setInterval(createEnemy, spawnRate);

    // Cria primeiro inimigo com delay
    setTimeout(createEnemy, 600);
}

function gameOver() {
    if (gameState === 'gameOver') return;
    console.log("Game Over!");
    gameState = 'gameOver';

    clearInterval(gameInterval);
    clearInterval(spawnInterval);
    gameInterval = null;
    spawnInterval = null;

    messageBoard.textContent = `FIM DE JOGO! Score: ${score}. [F5] para reiniciar.`;
    messageBoard.classList.add('active'); // Mostra mensagem final
    pauseMenu.classList.remove('active'); // Esconde menu de pausa
    typingInput.disabled = true;
    activeTarget = null;
    enemies.forEach(enemy => enemy.element.classList.add('frozen')); // Adiciona classe para congelar (estilo opcional)
}

function gameLoop() {
    updateEnemies();
}

// --- Listeners de Eventos ---

startButton.addEventListener('click', () => {
    if (validateAndSetUsername()) { // Valida e salva o usuário primeiro
        startMenu.classList.remove('active'); // Esconde menu inicial
        runGame();                       // Inicia o jogo
    }
    // Se não validar, a mensagem de erro já foi exibida
});

// Atualiza o nome no botão start enquanto digita no input
usernameInput.addEventListener('input', () => {
    const name = usernameInput.value.trim();
    startUsernameDisplay.textContent = name.length > 0 ? name : '...';
    usernameError.classList.remove('visible'); // Esconde erro ao digitar
});

resumeButton.addEventListener('click', resumeGame);
pauseButton.addEventListener('click', pauseGame);
typingInput.addEventListener('input', handleInput);

window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (gameState === 'playing') {
            pauseGame();
        } else if (gameState === 'paused') {
            resumeGame();
        }
    }
    // Permite iniciar o jogo com Enter no menu inicial se o input de user tiver foco
    if (gameState === 'menu' && document.activeElement === usernameInput && e.key === 'Enter') {
        startButton.click(); // Simula o clique no botão start
    }
});


// --- Inicialização ---
window.addEventListener('DOMContentLoaded', () => {
    loadUser(); // Carrega usuário salvo, se houver
    startMenu.classList.add('active'); // Mostra menu inicial
    console.log("Game ready. User loaded (if any). Waiting for start...");
});