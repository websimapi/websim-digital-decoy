import Phaser from 'phaser';

const GAME_WIDTH = 800;
const GAME_HEIGHT = 600;
const PLAYER_SIZE = 64; // Assuming PFPs are roughly square
const PLAYER_SPEED = 200;
const JUMP_VELOCITY = -450;
const GRAVITY = 800;
const ATTACK_RANGE = 80;
const ATTACK_DAMAGE = 10;

let room;
let phaserGame;
let cursors; // For keyboard input
let keyE, keyF, keyW, keyA, keyS, keyD, keySpace; // Specific keys

// UI Elements
const connectionStatusEl = document.getElementById('connection-status');
const lobbyInfoEl = document.getElementById('lobby-info');
const playerCountEl = document.getElementById('player-count');
const activeGamesListEl = document.getElementById('active-games-list').querySelector('ul');
const challengeModalEl = document.getElementById('challenge-modal');
const challengeMessageEl = document.getElementById('challenge-message');
const acceptChallengeBtn = document.getElementById('accept-challenge');
const declineChallengeBtn = document.getElementById('decline-challenge');
const gameHudEl = document.getElementById('game-hud');
const player1AvatarHud = document.getElementById('player1-avatar-hud');
const player1NameHud = document.getElementById('player1-name-hud');
const player1HealthHud = document.getElementById('player1-health-hud');
const player2AvatarHud = document.getElementById('player2-avatar-hud');
const player2NameHud = document.getElementById('player2-name-hud');
const player2HealthHud = document.getElementById('player2-health-hud');
const gameOverModalEl = document.getElementById('game-over-modal');
const gameOverMessageEl = document.getElementById('game-over-message');
const returnToLobbyBtn = document.getElementById('return-to-lobby');

let currentChallenge = null; // { fromId, fromUsername }

class BootScene extends Phaser.Scene {
    constructor() {
        super({ key: 'BootScene' });
    }

    preload() {
        console.log('BootScene: preload');
        // Load a placeholder platform texture
        this.load.image('platform-texture', 'assets/platform.png');
        // Placeholder for default avatar if PFP fails
        this.load.image('default-avatar', 'https://images.websim.com/default_avatar.png'); // Replace with actual default if needed

        // Dynamically load player PFPs based on current presence
        // This is tricky here as presence isn't fully known.
        // PFPs will be loaded in LobbyScene/GameScene as players join/appear.
    }

    create() {
        console.log('BootScene: create - transitioning to LobbyScene');
        this.scene.start('LobbyScene');
    }
}

class LobbyScene extends Phaser.Scene {
    constructor() {
        super({ key: 'LobbyScene' });
        this.playerSprites = {}; // clientId -> Phaser.GameObjects.Sprite
    }

    preload() {
        // Load PFPs for players already in room.presence
        if (room && room.presence) {
            for (const clientId in room.presence) {
                const pData = room.presence[clientId];
                if (pData.avatarUrl && !this.textures.exists('pfp_' + clientId)) {
                    this.load.image('pfp_' + clientId, pData.avatarUrl);
                }
            }
        }
         this.load.image('platform-texture', 'assets/platform.png'); // Ensure loaded if not globally
    }

    create() {
        console.log('LobbyScene: create');
        this.cameras.main.setBackgroundColor('#222233');
        this.updateLobbyUI();

        // Input setup
        cursors = this.input.keyboard.createCursorKeys();
        keyW = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
        keyA = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
        keyS = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
        keyD = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
        keySpace = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);


        if (room && room.clientId) {
            const myPresence = room.presence[room.clientId];
            if (myPresence && myPresence.state !== 'in_lobby') {
                 // If returning to lobby or initial state isn't lobby, ensure it is
                room.updatePresence({
                    ...myPresence,
                    state: 'in_lobby',
                    x: myPresence.x || GAME_WIDTH / 2,
                    y: myPresence.y || GAME_HEIGHT - PLAYER_SIZE,
                    currentGameId: null,
                });
            }
        }
        this.drawPlayers();
    }

    update() {
        if (!room || !room.clientId || !room.presence[room.clientId] || room.presence[room.clientId].state !== 'in_lobby') {
            return; // Not in lobby or not initialized
        }

        const myPresence = room.presence[room.clientId];
        let newX = myPresence.x;
        let newY = myPresence.y;
        let moved = false;

        if (Phaser.Input.Keyboard.JustDown(keyA) || Phaser.Input.Keyboard.JustDown(cursors.left)) newX -= PLAYER_SIZE / 2;
        if (Phaser.Input.Keyboard.JustDown(keyD) || Phaser.Input.Keyboard.JustDown(cursors.right)) newX += PLAYER_SIZE / 2;
        if (Phaser.Input.Keyboard.JustDown(keyW) || Phaser.Input.Keyboard.JustDown(cursors.up) || Phaser.Input.Keyboard.JustDown(keySpace)) newY -= PLAYER_SIZE / 2;
        if (Phaser.Input.Keyboard.JustDown(keyS) || Phaser.Input.Keyboard.JustDown(cursors.down)) newY += PLAYER_SIZE / 2;

        newX = Phaser.Math.Clamp(newX, PLAYER_SIZE / 2, GAME_WIDTH - PLAYER_SIZE / 2);
        newY = Phaser.Math.Clamp(newY, PLAYER_SIZE / 2, GAME_HEIGHT - PLAYER_SIZE / 2);


        if (newX !== myPresence.x || newY !== myPresence.y) {
            room.updatePresence({ ...myPresence, x: newX, y: newY });
            moved = true;
        }
        
        // Redraw players based on updated presence
        this.drawPlayers();
        this.updateLobbyUI();
    }

    drawPlayers() {
        if (!room || !room.presence) return;

        const currentSpriteKeys = Object.keys(this.playerSprites);
        const presentClientIds = Object.keys(room.presence);

        // Remove sprites for players no longer present or not in lobby
        for (const clientId of currentSpriteKeys) {
            if (!room.presence[clientId] || room.presence[clientId].state !== 'in_lobby') {
                if (this.playerSprites[clientId]) {
                    this.playerSprites[clientId].destroy();
                    delete this.playerSprites[clientId];
                }
            }
        }
        
        for (const clientId in room.presence) {
            const pData = room.presence[clientId];
            if (pData.state !== 'in_lobby' || !pData.avatarUrl) {
                if (this.playerSprites[clientId]) { // remove if not in lobby
                    this.playerSprites[clientId].destroy();
                    delete this.playerSprites[clientId];
                }
                continue;
            }

            const pfpKey = 'pfp_' + clientId;
            if (!this.textures.exists(pfpKey) && pData.avatarUrl) {
                this.load.once(`filecomplete-image-${pfpKey}`, () => {
                    if (room.presence[clientId] && room.presence[clientId].state === 'in_lobby') { // Check again in case state changed
                         this.addOrUpdatePlayerSprite(clientId, pData, pfpKey);
                    }
                });
                this.load.image(pfpKey, pData.avatarUrl);
                this.load.start();
            } else if (this.textures.exists(pfpKey)) {
                 this.addOrUpdatePlayerSprite(clientId, pData, pfpKey);
            } else if (!this.textures.exists(pfpKey) && !pData.avatarUrl) { // Fallback if no PFP URL
                 this.addOrUpdatePlayerSprite(clientId, pData, 'default-avatar');
            }
        }
    }
    
    addOrUpdatePlayerSprite(clientId, pData, textureKey) {
        if (this.playerSprites[clientId]) {
            this.playerSprites[clientId].setPosition(pData.x, pData.y);
            if(this.playerSprites[clientId].texture.key !== textureKey) {
                this.playerSprites[clientId].setTexture(textureKey);
            }
        } else {
            const sprite = this.add.sprite(pData.x, pData.y, textureKey)
                .setDisplaySize(PLAYER_SIZE, PLAYER_SIZE)
                .setInteractive();

            sprite.on('pointerdown', () => {
                if (clientId !== room.clientId && room.presence[room.clientId].state === 'in_lobby') {
                    console.log(`Challenge ${room.peers[clientId].username}`);
                    room.updatePresence({ ...room.presence[room.clientId], state: 'challenging', challengingWho: clientId });
                    room.requestPresenceUpdate(clientId, {
                        type: 'CHALLENGE_REQUEST',
                        fromId: room.clientId,
                        fromUsername: room.peers[room.clientId].username
                    });
                    challengeMessageEl.textContent = `Challenging ${room.peers[clientId].username}...`;
                    challengeModalEl.classList.remove('hidden');
                    acceptChallengeBtn.classList.add('hidden');
                    declineChallengeBtn.classList.remove('hidden'); // Acts as cancel for challenger
                    declineChallengeBtn.textContent = 'Cancel Challenge';

                }
            });
            this.playerSprites[clientId] = sprite;
        }
         // Add username text below sprite
        let nameText = this.children.list.find(child => child.getData && child.getData('clientId') === clientId && child.type === 'Text');
        if (!nameText) {
            nameText = this.add.text(pData.x, pData.y + PLAYER_SIZE / 2 + 5, room.peers[clientId]?.username || 'Player', {
                fontSize: '12px',
                fill: '#fff',
                fontFamily: 'Arial'
            }).setOrigin(0.5, 0);
            nameText.setData('clientId', clientId);
        } else {
            nameText.setPosition(pData.x, pData.y + PLAYER_SIZE / 2 + 5);
            nameText.setText(room.peers[clientId]?.username || 'Player');
        }
        this.playerSprites[clientId].setData('nameText', nameText); // associate text
    }


    updateLobbyUI() {
        playerCountEl.textContent = Object.values(room.presence || {}).filter(p => p.state === 'in_lobby').length;
        
        activeGamesListEl.innerHTML = '';
        if (room.roomState && room.roomState.activeGames) {
            for (const gameId in room.roomState.activeGames) {
                const game = room.roomState.activeGames[gameId];
                if (game && game.status !== 'finished') {
                    const player1Name = room.peers[game.player1Id]?.username || 'P1';
                    const player2Name = room.peers[game.player2Id]?.username || 'P2';
                    const li = document.createElement('li');
                    li.textContent = `${player1Name} vs ${player2Name}`;
                    
                    const spectateButton = document.createElement('button');
                    spectateButton.textContent = 'Spectate';
                    spectateButton.onclick = () => {
                        room.updatePresence({
                            ...room.presence[room.clientId],
                            state: 'in_game_spectator',
                            currentGameId: gameId
                        });
                        // Add self to spectators list in roomState (owner of game or first spectator does this ideally)
                        // This is simplified; proper update needs to merge with existing spectators.
                        const updatedGame = {...game, spectators: {...(game.spectators || {}), [room.clientId]: true}};
                        room.updateRoomState({ activeGames: { ...room.roomState.activeGames, [gameId]: updatedGame }});
                        this.scene.start('GameScene', { gameId });
                    };
                    li.appendChild(spectateButton);
                    activeGamesListEl.appendChild(li);
                }
            }
        }
    }
}


class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
        this.players = {}; // clientId -> { sprite, healthText, pfpKey }
        this.decoys = {}; // decoyId -> sprite
        this.gameData = null;
    }

    init(data) {
        this.gameId = data.gameId;
        this.gameData = room.roomState.activeGames[this.gameId];
        console.log(`GameScene: init for game ${this.gameId}`, this.gameData);

        // Clear existing player sprites from previous game, if any
        for (const id in this.players) {
            if (this.players[id].sprite) this.players[id].sprite.destroy();
            if (this.players[id].healthText) this.players[id].healthText.destroy();
        }
        this.players = {};
         for (const id in this.decoys) {
            if (this.decoys[id]) this.decoys[id].destroy();
        }
        this.decoys = {};
    }

    preload() {
        console.log('GameScene: preload');
        this.load.image('platform-texture', 'assets/platform.png');
        this.load.image('default-decoy', 'https://images.websim.com/default_avatar.png'); // Fallback for decoys

        if (!this.gameData) return;

        const playerIds = [this.gameData.player1Id, this.gameData.player2Id];
        playerIds.forEach(clientId => {
            if (clientId && room.peers[clientId] && room.peers[clientId].avatarUrl) {
                const pfpKey = 'pfp_' + clientId;
                if (!this.textures.exists(pfpKey)) {
                    this.load.image(pfpKey, room.peers[clientId].avatarUrl);
                }
            }
        });
    }

    create() {
        console.log('GameScene: create');
        if (!this.gameData) {
            console.error("Game data not found, returning to lobby.");
            this.returnToLobby();
            return;
        }
        
        this.cameras.main.setBackgroundColor('#4488cc');
        updateGameHudVisibility(true);

        // Platform
        this.platform = this.physics.add.staticImage(GAME_WIDTH / 2, GAME_HEIGHT - 50, 'platform-texture');
        this.platform.setScale( (GAME_WIDTH * 0.8) / this.platform.width, 0.5).refreshBody();


        // Controls
        cursors = this.input.keyboard.createCursorKeys();
        keyE = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
        keyF = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F);
        keyW = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
        keyA = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
        keyS = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
        keyD = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
        keySpace = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

        this.setupPlayers();
        this.physics.world.setBounds(0, 0, GAME_WIDTH, GAME_HEIGHT);
    }

    setupPlayers() {
        if (!this.gameData) return;
        const playerIds = [this.gameData.player1Id, this.gameData.player2Id];

        playerIds.forEach((clientId, index) => {
            if (!clientId || !room.presence[clientId]) return; // Player might have disconnected
            
            const pData = room.presence[clientId];
            const pfpKey = (room.peers[clientId] && room.peers[clientId].avatarUrl) ? 'pfp_' + clientId : 'default-avatar';
            
            if (!this.textures.exists(pfpKey) && room.peers[clientId] && room.peers[clientId].avatarUrl) {
                 // Texture might still be loading if scene started quickly
                this.load.once(`filecomplete-image-${pfpKey}`, () => this.addPlayerToScene(clientId, pfpKey, index));
                this.load.image(pfpKey, room.peers[clientId].avatarUrl);
                this.load.start();
            } else {
                 this.addPlayerToScene(clientId, pfpKey, index);
            }
        });
    }

    addPlayerToScene(clientId, textureKey, index) {
        if (this.players[clientId] && this.players[clientId].sprite) { // Already added
            this.players[clientId].sprite.setTexture(textureKey); // Update texture if changed
            return;
        }

        const startX = (index === 0) ? GAME_WIDTH * 0.25 : GAME_WIDTH * 0.75;
        const startY = GAME_HEIGHT - 150;
        
        const pSprite = this.physics.add.sprite(startX, startY, textureKey);
        pSprite.setDisplaySize(PLAYER_SIZE, PLAYER_SIZE)
            .setCollideWorldBounds(true)
            .setBounce(0.1)
            .setDragX(100); // Some ground friction

        this.physics.add.collider(pSprite, this.platform);
        
        pSprite.body.setGravityY(GRAVITY);

        if (clientId === room.clientId) { // It's me
            // Ensure my presence reflects game state
            room.updatePresence({
                ...room.presence[clientId],
                x: startX,
                y: startY,
                health: 100,
                velocityX: 0,
                velocityY: 0,
                isJumping: false,
                isDucking: false,
                facingDirection: (index === 0) ? "right" : "left",
            });
        }
        
        this.players[clientId] = {
            sprite: pSprite,
            health: room.presence[clientId]?.health || 100,
            pfpKey: textureKey,
            // healthText: this.add.text(0, 0, '', { fontSize: '14px', fill: '#fff' }) // Will be updated in update()
        };
        this.updatePlayerVisuals(clientId);
    }


    update() {
        if (!this.gameData || this.gameData.status === 'finished') {
             if(this.gameData && this.gameData.status === 'finished' && !gameOverModalEl.classList.contains('hidden')){
                // already showing game over
            } else if (this.gameData && this.gameData.status === 'finished') {
                this.showGameOver();
            }
            return;
        }
        
        this.gameData = room.roomState.activeGames[this.gameId]; // Refresh game data
        if (!this.gameData || this.gameData.status === 'finished') { // Check again after refresh
            if (this.gameData && !gameOverModalEl.classList.contains('hidden')) { /* no-op */ }
            else if (this.gameData) { this.showGameOver(); }
            else { this.returnToLobby(); } // Game data disappeared
            return;
        }


        const myClientId = room.clientId;
        const myPresence = room.presence[myClientId];

        // Update all player sprites and HUD based on presence
        const playerIds = [this.gameData.player1Id, this.gameData.player2Id];
        playerIds.forEach((id, idx) => {
            if (id && room.presence[id] && room.presence[id].state === 'in_game_player' && room.presence[id].currentGameId === this.gameId) {
                if (!this.players[id] || !this.players[id].sprite) {
                    // Player might have just loaded in, try to set them up
                    this.addPlayerToScene(id, (room.peers[id] && room.peers[id].avatarUrl) ? 'pfp_' + id : 'default-avatar', idx);
                }
                if (this.players[id] && this.players[id].sprite) { // Check again after potential add
                    const pData = room.presence[id];
                    const pSprite = this.players[id].sprite;
                    
                    if (id !== myClientId) { // For other players, directly set position from presence
                        pSprite.setPosition(pData.x, pData.y);
                        pSprite.setVelocity(pData.velocityX || 0, pData.velocityY || 0);
                    }
                    this.players[id].health = pData.health;
                    this.updatePlayerVisuals(id); // Updates ducking, facing direction visuals
                }
            } else if (id && this.players[id] && this.players[id].sprite) {
                 // Player left game or disconnected, remove their sprite
                this.players[id].sprite.destroy();
                // if(this.players[id].healthText) this.players[id].healthText.destroy();
                delete this.players[id];
            }
        });
        this.updateGameHud();


        // Handle input for local player
        if (myPresence && myPresence.state === 'in_game_player' && this.players[myClientId] && this.players[myClientId].sprite) {
            const mySprite = this.players[myClientId].sprite;
            let newVelocityX = mySprite.body.velocity.x;
            let newFacingDirection = myPresence.facingDirection;
            let newIsDucking = myPresence.isDucking;

            if (keyA.isDown || cursors.left.isDown) {
                newVelocityX = -PLAYER_SPEED;
                newFacingDirection = "left";
            } else if (keyD.isDown || cursors.right.isDown) {
                newVelocityX = PLAYER_SPEED;
                newFacingDirection = "right";
            } else {
                // newVelocityX = 0; // Let drag handle slowdown if preferred
            }
            mySprite.setVelocityX(newVelocityX);

            if ((keyW.isDown || cursors.up.isDown || keySpace.isDown) && mySprite.body.touching.down) {
                mySprite.setVelocityY(JUMP_VELOCITY);
            }

            newIsDucking = (keyS.isDown || cursors.down.isDown);

            // Update presence if changed
            if (mySprite.x !== myPresence.x || mySprite.y !== myPresence.y ||
                mySprite.body.velocity.x !== myPresence.velocityX || mySprite.body.velocity.y !== myPresence.velocityY ||
                newFacingDirection !== myPresence.facingDirection || newIsDucking !== myPresence.isDucking) {
                room.updatePresence({
                    ...myPresence,
                    x: mySprite.x,
                    y: mySprite.y,
                    velocityX: mySprite.body.velocity.x,
                    velocityY: mySprite.body.velocity.y,
                    facingDirection: newFacingDirection,
                    isDucking: newIsDucking,
                    isJumping: !mySprite.body.touching.down
                });
            }
            
            // Attack
            if (Phaser.Input.Keyboard.JustDown(keyF)) {
                this.performAttack(myClientId);
            }

            // Decoy
            if (Phaser.Input.Keyboard.JustDown(keyE)) {
                this.activateDecoy(myClientId);
            }
        }
        
        this.updateDecoys();
        this.checkPlayerOutOfBounds();
    }

    updatePlayerVisuals(clientId) {
        const pData = room.presence[clientId];
        const playerObj = this.players[clientId];
        if (!pData || !playerObj || !playerObj.sprite) return;

        playerObj.sprite.setFlipX(pData.facingDirection === "left");
        playerObj.sprite.setScale(1, pData.isDucking ? 0.6 : 1);

        // // Update health text position (removed for HUD)
        // if (playerObj.healthText) {
        //     playerObj.healthText.setText(`${room.peers[clientId]?.username}: ${pData.health}HP`);
        //     playerObj.healthText.setPosition(playerObj.sprite.x, playerObj.sprite.y - PLAYER_SIZE / 2 - 10).setOrigin(0.5);
        // }
    }
    
    updateGameHud() {
        if (!this.gameData) return;
        const p1Id = this.gameData.player1Id;
        const p2Id = this.gameData.player2Id;

        if (p1Id && room.peers[p1Id] && room.presence[p1Id]) {
            player1AvatarHud.src = room.peers[p1Id].avatarUrl || 'assets/default-avatar.png';
            player1NameHud.textContent = room.peers[p1Id].username;
            player1HealthHud.textContent = room.presence[p1Id].health;
        } else {
            player1NameHud.textContent = "Player 1"; player1HealthHud.textContent = "N/A";
        }
        
        if (p2Id && room.peers[p2Id] && room.presence[p2Id]) {
            player2AvatarHud.src = room.peers[p2Id].avatarUrl || 'assets/default-avatar.png';
            player2NameHud.textContent = room.peers[p2Id].username;
            player2HealthHud.textContent = room.presence[p2Id].health;
        } else {
             player2NameHud.textContent = "Player 2"; player2HealthHud.textContent = "N/A";
        }
    }

    performAttack(attackerId) {
        const attackerPresence = room.presence[attackerId];
        const attackerSprite = this.players[attackerId].sprite;
        if (!attackerPresence || !attackerSprite) return;

        const targetId = (attackerId === this.gameData.player1Id) ? this.gameData.player2Id : this.gameData.player1Id;
        const targetPresence = room.presence[targetId];
        const targetSprite = this.players[targetId] ? this.players[targetId].sprite : null;

        if (!targetPresence || !targetSprite) return; // Target not in game or not found

        const distance = Phaser.Math.Distance.Between(attackerSprite.x, attackerSprite.y, targetSprite.x, targetSprite.y);
        
        // Check facing direction for attack validity
        const isFacingTarget = (attackerPresence.facingDirection === "right" && attackerSprite.x < targetSprite.x) ||
                               (attackerPresence.facingDirection === "left" && attackerSprite.x > targetSprite.x);

        if (distance < ATTACK_RANGE && isFacingTarget) {
            console.log(`${attackerId} attacks ${targetId}`);
            room.requestPresenceUpdate(targetId, {
                type: 'DAMAGE_REQUEST',
                amount: ATTACK_DAMAGE,
                fromId: attackerId
            });
            // Visual feedback for attack (e.g., tint attacker briefly)
            attackerSprite.setTint(0xff0000);
            this.time.delayedCall(100, () => attackerSprite.clearTint());
        }
    }

    async activateDecoy(ownerId) {
        const ownerPresence = room.presence[ownerId];
        if (!ownerPresence || ownerPresence.activeDecoyId) return; // Already has an active decoy

        const pfpUrl = room.peers[ownerId].avatarUrl || 'assets/default-decoy.png';
        const decoyId = `decoy_${ownerId}_${Date.now()}`;

        try {
            // LLM interaction for flavor, as per prompt
            console.log("Attempting LLM interaction for decoy...");
            const llmInteraction = await websim.chat.completions.create({
                messages: [
                    { role: "system", content: "You are an AI assistant in a game. A player is using a decoy ability. Briefly acknowledge this." },
                    {
                        role: "user",
                        content: [
                            { type: 'text', text: `Player ${room.peers[ownerId].username} is activating a decoy. Acknowledge their PFP.` },
                            { type: 'image_url', image_url: { url: pfpUrl } }
                        ]
                    }
                ]
            });
            console.log("LLM Decoy Acknowledgment:", llmInteraction.content);

            const decoyX = ownerPresence.x + (ownerPresence.facingDirection === 'right' ? PLAYER_SIZE : -PLAYER_SIZE);
            const decoyY = ownerPresence.y;

            room.updateRoomState({
                decoyInstances: {
                    ...room.roomState.decoyInstances,
                    [decoyId]: {
                        ownerId: ownerId,
                        gameId: this.gameId, // Associate decoy with this game
                        x: decoyX,
                        y: decoyY,
                        imageUrl: pfpUrl,
                        createdAt: Date.now()
                    }
                }
            });
            room.updatePresence({ ...ownerPresence, activeDecoyId: decoyId });

            // Owner sets timer to remove decoy
            setTimeout(() => {
                const currentDecoys = { ...room.roomState.decoyInstances };
                if (currentDecoys[decoyId]) { // Check if it still exists (e.g. game didn't end abruptly)
                    delete currentDecoys[decoyId];
                    room.updateRoomState({ decoyInstances: currentDecoys });
                }
                // Check if this client is the owner and if the activeDecoyId is still this one
                if (room.clientId === ownerId && room.presence[ownerId] && room.presence[ownerId].activeDecoyId === decoyId) {
                    room.updatePresence({ ...room.presence[ownerId], activeDecoyId: null });
                }
            }, 7000);

        } catch (error) {
            console.error("Decoy LLM/creation error:", error);
            // Fallback: create decoy without LLM interaction if it fails
             const decoyX = ownerPresence.x + (ownerPresence.facingDirection === 'right' ? PLAYER_SIZE : -PLAYER_SIZE);
             const decoyY = ownerPresence.y;
             room.updateRoomState({
                decoyInstances: { ...room.roomState.decoyInstances, [decoyId]: { ownerId, gameId: this.gameId, x: decoyX, y: decoyY, imageUrl: pfpUrl, createdAt: Date.now()}}
            });
            room.updatePresence({ ...ownerPresence, activeDecoyId: decoyId });
             setTimeout(() => { /* ... same removal logic ... */
                const currentDecoys = { ...room.roomState.decoyInstances };
                if (currentDecoys[decoyId]) { delete currentDecoys[decoyId]; room.updateRoomState({ decoyInstances: currentDecoys });}
                if (room.clientId === ownerId && room.presence[ownerId] && room.presence[ownerId].activeDecoyId === decoyId) {
                    room.updatePresence({ ...room.presence[ownerId], activeDecoyId: null });
                }
             }, 7000);
        }
    }

    updateDecoys() {
        const now = Date.now();
        // Remove expired server-side decoys (client-side check as fallback)
        for (const decoyId in room.roomState.decoyInstances) {
            const decoyData = room.roomState.decoyInstances[decoyId];
            if (decoyData && decoyData.gameId === this.gameId) {
                 if (now - decoyData.createdAt > 7000 && this.decoys[decoyId]) {
                    this.decoys[decoyId].destroy();
                    delete this.decoys[decoyId];
                    // Owner should have removed from roomState, but good to cleanup local sprite.
                    // If I am the owner of this now-expired decoy, and my presence still thinks it's active, clear it
                    if(room.clientId === decoyData.ownerId && room.presence[room.clientId].activeDecoyId === decoyId) {
                        room.updatePresence({...room.presence[room.clientId], activeDecoyId: null});
                    }
                    continue; 
                }

                if (!this.decoys[decoyId]) { // New decoy
                    const decoySpriteKey = `decoy_img_${decoyData.ownerId}`; // Unique key for decoy image
                    if (!this.textures.exists(decoySpriteKey)) {
                        this.load.image(decoySpriteKey, decoyData.imageUrl);
                        this.load.once(`filecomplete-image-${decoySpriteKey}`, () => {
                             if(room.roomState.decoyInstances[decoyId]) { // check if still valid after load
                                this.decoys[decoyId] = this.add.sprite(decoyData.x, decoyData.y, decoySpriteKey).setDisplaySize(PLAYER_SIZE, PLAYER_SIZE).setAlpha(0.7);
                             }
                        });
                        this.load.start();
                    } else {
                         this.decoys[decoyId] = this.add.sprite(decoyData.x, decoyData.y, decoySpriteKey).setDisplaySize(PLAYER_SIZE, PLAYER_SIZE).setAlpha(0.7);
                    }
                } else { // Existing decoy, update position (though they are static for now)
                    this.decoys[decoyId].setPosition(decoyData.x, decoyData.y);
                }
            } else if (decoyData && decoyData.gameId !== this.gameId && this.decoys[decoyId]) {
                // Decoy from another game, remove if present locally
                 this.decoys[decoyId].destroy();
                 delete this.decoys[decoyId];
            }
        }
        // Clean up local decoy sprites if their data is gone from roomState
        for (const decoyId in this.decoys) {
            if (!room.roomState.decoyInstances || !room.roomState.decoyInstances[decoyId]) {
                this.decoys[decoyId].destroy();
                delete this.decoys[decoyId];
            }
        }
    }
    
    checkPlayerOutOfBounds() {
        if(!this.gameData || !this.gameData.player1Id || !this.gameData.player2Id) return;

        const playerIds = [this.gameData.player1Id, this.gameData.player2Id];
        playerIds.forEach(playerId => {
            if (this.players[playerId] && this.players[playerId].sprite) {
                const sprite = this.players[playerId].sprite;
                if (sprite.y > GAME_HEIGHT + PLAYER_SIZE) { // Fell off bottom
                    if (room.clientId === playerId) { // I fell off
                        room.updatePresence({ ...room.presence[playerId], health: 0 }); // Instant KO
                        // The presence update will trigger defeat check
                    }
                }
            }
        });
    }


    showGameOver() {
        if (!this.gameData || gameOverModalEl.classList.contains('hidden') === false) return; // Already shown or no game data
        
        updateGameHudVisibility(false);
        gameOverModalEl.classList.remove('hidden');
        
        const winnerId = this.gameData.winner;
        if (winnerId) {
            const winnerName = room.peers[winnerId] ? room.peers[winnerId].username : "Someone";
            gameOverMessageEl.textContent = `${winnerName} wins!`;
        } else {
            // This case could be a draw or game ended for other reasons
            gameOverMessageEl.textContent = 'Game Over!';
        }
        // Stop physics or scene updates if necessary
        this.physics.pause();
    }

    returnToLobby() {
        updateGameHudVisibility(false);
        gameOverModalEl.classList.add('hidden');
        challengeModalEl.classList.add('hidden');
        lobbyInfoEl.classList.remove('hidden');

        const myPresence = room.presence[room.clientId];
        if (myPresence) {
             room.updatePresence({
                ...myPresence,
                state: 'in_lobby',
                currentGameId: null,
                health: 100, // Reset health
                x: GAME_WIDTH / 2, // Reset position for lobby
                y: GAME_HEIGHT - PLAYER_SIZE,
                activeDecoyId: null,
            });
        }
        this.scene.stop('GameScene'); // Stop this scene fully
        phaserGame.scene.start('LobbyScene'); // Restart LobbyScene to refresh its state
    }
}

// Phaser Game Configuration
const phaserConfig = {
    type: Phaser.AUTO,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    parent: 'game-container',
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: GRAVITY },
            debug: false // Set to true for physics debugging
        }
    },
    scene: [BootScene, LobbyScene, GameScene],
    render: {
        pixelArt: false, // Adjust if using pixel art assets
        antialias: true,
    }
};


async function initApp() {
    room = new WebsimSocket();

    room.onmessage = (event) => {
        console.log("Received message:", event);
        // Handle custom broadcast events if any (none defined yet)
    };

    room.subscribePresence((newPresence) => {
        // console.log("Presence updated:", newPresence);
        if (phaserGame && phaserGame.scene.isActive('LobbyScene')) {
            const lobbyScene = phaserGame.scene.getScene('LobbyScene');
            if(lobbyScene.preload && typeof lobbyScene.preload === 'function' && !lobbyScene.scene.settings.isSleeping) { // Check if scene is active
                // New player joined, may need to load their PFP
                for (const clientId in newPresence) {
                    const pData = newPresence[clientId];
                    if (pData.avatarUrl && !phaserGame.textures.exists('pfp_' + clientId) && pData.state === 'in_lobby') {
                         lobbyScene.load.image('pfp_' + clientId, pData.avatarUrl);
                         lobbyScene.load.start(); // Manually start loader if outside preload
                    }
                }
            }
           if (lobbyScene.drawPlayers && typeof lobbyScene.drawPlayers === 'function'  && !lobbyScene.scene.settings.isSleeping) {
                lobbyScene.drawPlayers(); // Redraw lobby players on any presence change
                lobbyScene.updateLobbyUI();
            }
        }

        // Update HUD if in game
        if (phaserGame && phaserGame.scene.isActive('GameScene')) {
            const gameScene = phaserGame.scene.getScene('GameScene');
            const myPresence = newPresence[room.clientId];
            if(myPresence && myPresence.state === 'in_game_player' && myPresence.currentGameId) {
                 gameScene.updateGameHud();

                 // Check for defeat condition based on health for any player
                const gameData = room.roomState.activeGames ? room.roomState.activeGames[myPresence.currentGameId] : null;
                if(gameData && gameData.status !== 'finished') {
                    [gameData.player1Id, gameData.player2Id].forEach(pid => {
                        if (newPresence[pid] && newPresence[pid].health <= 0 && newPresence[pid].state === 'in_game_player') {
                            // This player is defeated. If it's me, I update roomState.
                            // Otherwise, the defeated player's client should do this.
                            // This is a failsafe/observer check.
                            if(room.clientId === pid) { // I am defeated
                                const winnerId = pid === gameData.player1Id ? gameData.player2Id : gameData.player1Id;
                                room.updateRoomState({
                                    activeGames: {
                                        ...room.roomState.activeGames,
                                        [myPresence.currentGameId]: { ...gameData, status: 'finished', winner: winnerId }
                                    }
                                });
                            }
                        }
                    });
                }
            }
        }
        updateConnectionStatus();
    });

    room.subscribeRoomState((newRoomState) => {
        // console.log("Room state updated:", newRoomState);
        if (phaserGame && phaserGame.scene.isActive('LobbyScene')) {
            const lobbyScene = phaserGame.scene.getScene('LobbyScene');
            if(lobbyScene.updateLobbyUI && typeof lobbyScene.updateLobbyUI === 'function' && !lobbyScene.scene.settings.isSleeping) {
                 lobbyScene.updateLobbyUI();
            }
        }
        if (phaserGame && phaserGame.scene.isActive('GameScene')) {
            const gameScene = phaserGame.scene.getScene('GameScene');
            const myPresence = room.presence[room.clientId];
            if(myPresence && myPresence.currentGameId && newRoomState.activeGames && newRoomState.activeGames[myPresence.currentGameId]) {
                 gameScene.gameData = newRoomState.activeGames[myPresence.currentGameId]; // Update gameScene's copy
                 if (gameScene.gameData.status === 'finished' && !gameOverModalEl.classList.contains('hidden')) {
                     // Already showing game over
                 } else if (gameScene.gameData.status === 'finished') {
                     gameScene.showGameOver();
                 }
            } else if (myPresence && myPresence.currentGameId && (!newRoomState.activeGames || !newRoomState.activeGames[myPresence.currentGameId])) {
                // Game seems to have ended or disappeared from roomState
                console.log("Game ended or removed from room state. Returning to lobby.");
                gameScene.returnToLobby();
            }
        }
    });

    room.subscribePresenceUpdateRequests((updateRequest, fromClientId) => {
        console.log("Presence update request from", fromClientId, ":", updateRequest);
        const myPresence = room.presence[room.clientId];

        if (updateRequest.type === 'CHALLENGE_REQUEST') {
            if (myPresence.state === 'in_lobby') { // Can only be challenged if in lobby
                currentChallenge = { fromId: fromClientId, fromUsername: updateRequest.fromUsername };
                room.updatePresence({ ...myPresence, state: 'challenged_by', challengedByWho: fromClientId });
                challengeMessageEl.textContent = `${updateRequest.fromUsername} challenges you!`;
                challengeModalEl.classList.remove('hidden');
                acceptChallengeBtn.classList.remove('hidden');
                declineChallengeBtn.classList.remove('hidden');
                declineChallengeBtn.textContent = 'Decline';
            } else {
                // Busy, auto-decline or ignore
                room.requestPresenceUpdate(fromClientId, { type: 'CHALLENGE_DECLINED', reason: 'busy' });
            }
        } else if (updateRequest.type === 'CHALLENGE_ACCEPTED') {
            if (myPresence.state === 'challenging' && myPresence.challengingWho === fromClientId) {
                challengeModalEl.classList.add('hidden'); // Hide my "challenging..." modal
                room.updatePresence({
                    ...myPresence,
                    state: 'in_game_player',
                    currentGameId: updateRequest.gameId,
                    health: 100,
                    x: GAME_WIDTH * 0.25, y: GAME_HEIGHT - 150, // Initial pos for P1
                    velocityX: 0, velocityY: 0, isJumping: false, isDucking: false, facingDirection: "right", activeDecoyId: null
                });
                lobbyInfoEl.classList.add('hidden');
                if(phaserGame.scene.isActive('LobbyScene')) phaserGame.scene.stop('LobbyScene');
                phaserGame.scene.start('GameScene', { gameId: updateRequest.gameId });
            }
        } else if (updateRequest.type === 'CHALLENGE_DECLINED') {
             if (myPresence.state === 'challenging' && myPresence.challengingWho === fromClientId) {
                challengeMessageEl.textContent = `${room.peers[fromClientId].username} declined. (${updateRequest.reason || ''})`;
                acceptChallengeBtn.classList.add('hidden');
                declineChallengeBtn.textContent = 'OK'; // Change cancel to OK
                // Keep modal open for a bit or require OK click
                // setTimeout(() => { // auto close after a delay
                //    if(room.presence[room.clientId].state === 'challenging' && room.presence[room.clientId].challengingWho === fromClientId) { // if still in this state
                //        challengeModalEl.classList.add('hidden');
                //        room.updatePresence({...myPresence, state: 'in_lobby', challengingWho: null });
                //    }
                // }, 3000);
             }
        } else if (updateRequest.type === 'DAMAGE_REQUEST') {
            if (myPresence.state === 'in_game_player' && myPresence.currentGameId && room.roomState.activeGames[myPresence.currentGameId]) {
                const game = room.roomState.activeGames[myPresence.currentGameId];
                if (game.status === 'active' || game.status === 'starting') { // Can only take damage if game is active
                    let newHealth = myPresence.health - updateRequest.amount;
                    let defeated = false;
                    if (newHealth <= 0) {
                        newHealth = 0;
                        defeated = true;
                    }
                    room.updatePresence({ ...myPresence, health: newHealth });
                    
                    if (this.phaserGame && this.phaserGame.scene.isActive('GameScene')) {
                        const gameScene = this.phaserGame.scene.getScene('GameScene');
                        const mySprite = gameScene.players[room.clientId]?.sprite;
                        if (mySprite) { // Visual feedback for damage
                            mySprite.setTint(0xffaaaa);
                            gameScene.time.delayedCall(150, () => mySprite.clearTint());
                        }
                    }


                    if (defeated) {
                        // I am defeated, update roomState to declare winner
                        const winnerId = updateRequest.fromId; // The one who sent the damage request that KO'd me
                         room.updateRoomState({
                            activeGames: {
                                ...room.roomState.activeGames,
                                [myPresence.currentGameId]: { ...game, status: 'finished', winner: winnerId }
                            }
                        });
                        // GameScene will pick up 'finished' status via roomState subscription
                    }
                }
            }
        }
    });

    try {
        await room.initialize();
        console.log("Websim initialized. Client ID:", room.clientId);
        console.log("Peers:", room.peers);
        console.log("Initial presence:", room.presence);
        console.log("Initial room state:", room.roomState);
        connectionStatusEl.textContent = `Connected as ${room.peers[room.clientId].username}`;

        if (Object.keys(room.roomState).length === 0) { // First player in an empty room
            room.updateRoomState({
                gameState: "lobby",
                activeGames: {},
                decoyInstances: {}
            });
        }
        
        const initialX = Math.random() * (GAME_WIDTH - PLAYER_SIZE) + PLAYER_SIZE / 2;
        const initialY = Math.random() * (GAME_HEIGHT - PLAYER_SIZE) + PLAYER_SIZE / 2;

        if (!room.presence[room.clientId]) { // If no presence yet, set initial
            room.updatePresence({
                username: room.peers[room.clientId].username,
                avatarUrl: room.peers[room.clientId].avatarUrl,
                state: 'in_lobby', // "in_lobby", "challenging", "challenged_by", "in_game_player", "in_game_spectator"
                currentGameId: null,
                x: initialX,
                y: initialY,
                health: 100,
                velocityX: 0,
                velocityY: 0,
                isJumping: false,
                isDucking: false,
                facingDirection: "right",
                activeDecoyId: null,
            });
        } else { // If presence exists (e.g. reconnected), ensure state is lobby if not in game
            const currentPresence = room.presence[room.clientId];
            if (currentPresence.state !== 'in_game_player' && currentPresence.state !== 'in_game_spectator') {
                 room.updatePresence({
                    ...currentPresence, // keep existing x,y if available
                    state: 'in_lobby',
                    currentGameId: null,
                    username: room.peers[room.clientId].username, // ensure these are fresh
                    avatarUrl: room.peers[room.clientId].avatarUrl,
                 });
            } else if (currentPresence.currentGameId && (!room.roomState.activeGames || !room.roomState.active

