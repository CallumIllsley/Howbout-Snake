
class SnakeGame {

    static NUM_ROWS = 60;
    static NUM_COLS = 120;

    // API Key should be stored behind a .env in a production environment
    static API_URL = 'https://snake.howbout.app/api/callum'

    boardCells = [];
    score = 0;

    constructor(board, controls, leaderboardForm) {

        this.board = board;
        this.controls = controls;
        this.leaderboardForm = leaderboardForm;

        this.scoreCounter = this.controls.querySelector('.score');

        this.initBoard();

        this.snake = new Snake(this);
        this.food = new Food(this);
        this.wall = new Wall(this);

        // Bind the submit action from the leaderboard to the submit function
        leaderboardForm.addEventListener('submit', this.submitPlayerScore.bind(this));

        window.addEventListener('keydown', (event) => {
            switch (event.key) {
                case ' ':
                    this.snake.usePowerup();
                    break;
                case 'ArrowLeft':
                case 'a':
                    this.snake.setDirection('left');
                    break;

                case 'ArrowUp':
                case 'w':
                    this.snake.setDirection('up');
                    break;

                case 'ArrowRight':
                case 'd':
                    this.snake.setDirection('right');
                    break;

                case 'ArrowDown':
                case 's':
                    this.snake.setDirection('down');
                    break;
                case 'Escape':
                    this.snake.pause();
                    break;
            }
        });

    }

    /**
     * Build the board using rows of cells
     */
    initBoard() {

        // Generate a new row
        const newRow = (rowNum) => {
            const row = document.createElement('div');
            row.classList.add('row');
            row.classList.add('row-' + rowNum);
            return row;
        }
        // Generate a new column
        const newCol = (colNum) => {
            const col = document.createElement('div');
            col.classList.add('col');
            col.classList.add('col-' + colNum);
            return col;
        }

        // For each number of rows make a new row element and fill with columns
        for (let r = 0; r < SnakeGame.NUM_ROWS; r++) {

            const row = newRow(r);
            const boardCellsRow = [];

            // For each number of columns make a new column element and add to the row
            for (let c = 0; c < SnakeGame.NUM_COLS; c++) {

                const col = newCol(c);
                row.appendChild(col);
                boardCellsRow.push(col);

            }

            this.board.appendChild(row);
            this.boardCells.push(boardCellsRow);

        }

    }

    /**
     * Begin the game
     */
    play() {

        this.controls.classList.add('playing');
        document.getElementById('help').classList.add('hidden');

        this.snake.move();
        this.food.spawn();
    }

    /**
     * Restart the game after game over
     */
    restart() {

        this.snake.reset();
        this.wall.clearAll();
        this.food.clearAll();
        this.controls.classList.remove('game-over');
        this.board.classList.remove('game-over');
        this.board.classList.remove('display-leaderboard');
        this.score = 0;
        this.scoreCounter.innerText = this.score;
        this.play();

    }

    /**
     * Increment the user's score
     */
    increaseScore(amount) {

        this.score += amount;
        this.scoreCounter.innerText = this.score;

    }

    /**
     * End the game
     */
    async gameOver() {

        this.snake.pause();

        this.controls.classList.remove('playing');
        this.controls.classList.add('game-over');
        this.board.classList.add('game-over');

        document.getElementById('playerScore').innerHTML = this.score;
    }

    async submitPlayerScore(e) {
        e.preventDefault();

        const playerName = e.target.querySelector('#player').value;

        // Check if the player has submitted a valid name
        if (playerName == null || playerName == '') {
            document.getElementById('player').classList.add('shake');

            setTimeout(() => {
                document.getElementById('player').classList.remove('shake');
            }, 2000)

            return;
        }

        let body = {
            name: playerName,
            score: this.score
        }

        // Post the players score
        try {
            let res = await fetch(`${SnakeGame.API_URL}/high-scores`,
                {
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(body),
                    method: 'post'
                })

            if (res.ok) {
                this.displayLeaderboard();
            } else {
                throw Error;
            }

        } catch (err) {
            alert('There was an issue connecting to the server.');
        }

    }

    async displayLeaderboard() {

        // Check if game is in play (for manual opening of leaderboard
        if (!this.board.classList.contains('playing')) {
            // Switch from form view to leaderboard view
            this.board.classList.remove('game-over')

            // Fetch reference of table and clear to prevent duplicates 
            let body = this.board.querySelector('#leaderboard tbody')
            body.innerHTML = '';

            let data;

            try {
                let res = await fetch(`${SnakeGame.API_URL}/high-scores`);

                if (res.ok) {
                    data = await res.json();
                } else {
                    throw Error;
                }

            } catch (err) {
                alert('There was an issue connecting to the server.');
            }

            // Sort the top 50 scores in descending order to be displayed in the leaderboard
            data.sort((a, b) => { return b.score - a.score }).slice(0, 50)

            // Generate the table with the sorted data
            data.forEach((entry, idx) => {

                // Dont display 0 scores
                if (entry.score == 0) {
                    return;
                }

                let tr = body.insertRow();

                let rank = document.createElement('td');

                if (idx == 0) {
                    rank.innerHTML = `⭐ ${idx + 1} ⭐`;
                } else {
                    rank.innerHTML = idx + 1;
                }

                tr.appendChild(rank);

                let player = document.createElement('td');
                player.innerHTML = entry.name;
                tr.appendChild(player);

                let score = document.createElement('td');
                score.innerHTML = entry.score;
                tr.appendChild(score);

                let date = document.createElement('td');
                let formattedDate = new Date(entry['created_at']);
                date.innerHTML = `${formattedDate.getDay()}/${formattedDate.getMonth()}/${formattedDate.getFullYear()}`;
                tr.appendChild(date);
            })

            this.board.classList.add('display-leaderboard')
        }
    }
}

class Snake {

    static STARTING_EDGE_OFFSET = 20;
    static MAX_SPEED = 40;

    tail = [];
    tailLength = 6;
    direction = 'up';
    updatedDirection = 'up';
    speed = 160;
    moving = false;
    playerLevel = 0;
    difficulty = 0;
    powerupActive = false;

    constructor(game) {

        this.game = game;

        this.init();

    }

    /**
     * Place the snake initially
     */
    init() {

        const x = Math.floor(Math.random() * (SnakeGame.NUM_COLS - Snake.STARTING_EDGE_OFFSET)) + (Snake.STARTING_EDGE_OFFSET / 2);
        const y = Math.floor(Math.random() * (SnakeGame.NUM_ROWS - Snake.STARTING_EDGE_OFFSET)) + (Snake.STARTING_EDGE_OFFSET / 2);
        this.position = { x, y };

        const startCell = this.game.boardCells[y][x];
        startCell.classList.add('snake');

        this.tail.push(startCell);
        this.tail[0].classList.add('head');
    }

    /**
     * Move the snake
     */
    move() {

        // If this is the first move, make sure the game isn't paused
        if (!this.moving) {
            this.moving = true;
            this.game.controls.classList.remove('paused');
        }

        // Calculate the next position of the snake
        this.updatePosition();

        // If the move is not valid, end the game
        if (!this.isValidMove()) {
            this.game.gameOver();
            return;
        }

        // Get the updated board cell
        const currentBoardCell = this.game.boardCells[this.position['y']][this.position['x']];

        // If the new position contains food
        if (currentBoardCell.classList.contains('food')) {
            this.eatFood(currentBoardCell);
        }

        this.direction = this.updatedDirection;

        this.updateGameBoard();

        // Move another step in `this.speed` number of milliseconds
        this.movementTimer = setTimeout(() => { this.move(); }, this.speed);
    }

    /**
     * Set the snake's direction
     */
    setDirection(direction) {

        // The player should be able to move in all 4 directions when the snake spwans
        if (this.tail.length > 1) {
            // Check if the player is trying to direct the snake back onto itself and prevent an invalid move 
            if ((direction == 'left' || direction == 'right') && (this.direction == 'left' || this.direction == 'right')) {
                console.log('Invalid Movement: Snake cannot turn on itself');
                return;
            }

            if ((direction == 'up' || direction == 'down') && (this.direction == 'up' || this.direction == 'down')) {
                console.log('Invalid Movement: Snake cannot turn on itself');
                return;
            }
        }
        
        // Update the snake direction in the next loop to prevent the above logic from breaking
        this.updatedDirection = direction;
    }

    /* 
        Update the snakes position on the game board
    */
    updatePosition() {
        switch (this.direction) {
            case 'up':
                this.position['y'] -= 1;
                break;
            case 'down':
                this.position['y'] += 1;
                break;
            case 'left':
                this.position['x'] -= 1;
                break;
            case 'right':
                this.position['x'] += 1;
                break;

        }
    }

    /* 
        Update the game board with the new position of the snake
    */
    updateGameBoard() {

        // Get the new position of the snake and update the cell
        const newPosition = this.game.boardCells[this.position['y']][this.position['x']];
        newPosition.classList.add('snake');

        // Append the new position to the snake and update the head position
        this.tail[this.tail.length - 1].classList.remove('head')
        this.tail.push(newPosition);
        this.tail[this.tail.length - 1].classList.add('head')

        // Remove the previous tail position from the game board
        const prevPosition = this.tail.shift();
        prevPosition.classList.remove('snake');
    }


    /*
        Check if the next position of the snake is a valid one
        - If snake goes out of bounds
        - If snake collides with itself
        - If snake collides with a wall
    */
    isValidMove() {

        // Check if the snake is out of the game board
        if (this.position['y'] >= SnakeGame.NUM_ROWS || this.position['y'] < 0) {
            console.log('Invalid Movement: Snake is out of bounds');
            return false;
        }
        else if (this.position['x'] >= SnakeGame.NUM_COLS || this.position['x'] < 0) {
            console.log('Invalid Movement: Snake is out of bounds');
            return false;
        }
        // Check if the snake has collided with a wall
        else if (this.game.boardCells[this.position['y']][this.position['x']].classList.contains('wall')) {
            console.log('Invalid Movement: Snake has collided with a wall');
            return false;
        }
        // Check if the snake has collided with itself
        else if (this.game.boardCells[this.position['y']][this.position['x']].classList.contains('snake')) {
            console.log('Invalid Movement: Snake has collided with itself');
            return false;
        }

        return true;
    }

    /*
        Update the snake with the desired new speed
    */
    updateSpeed(newSpeed) {
        if (newSpeed > Snake.MAX_SPEED) {
            this.speed = newSpeed;
        } else {
            this.speed = Snake.MAX_SPEED;
        }
    }

    /* 
        Increase the powerup level
    */
    increaseLevel() {
        if (this.playerLevel < 5) {
            let segments = document.getElementById('powerupSegments').children;

            segments[this.playerLevel].classList.add('filled');

            this.playerLevel++;
        }

        if (this.playerLevel == 5) {
            document.getElementById('powerupSegments').classList.add('full')
            document.getElementById('powerupHeading').innerHTML = 'Powerup Ready!'
        }
    }

    /* 
        Reset the player level
    */
    resetLevel() {
        let segments = document.getElementById('powerupSegments').children;

        for (let i = 0; i < segments.length; i++) {
            segments[i].classList.remove('filled');
        }

        document.getElementById('powerupSegments').classList.remove('full')

        this.playerLevel = 0;
    }


    /* 
        Increase the game difficulty by spawning a new wall
    */
    increaseDifficulty() {
        this.difficulty++;

        this.game.wall.spawn();
    }

    /*
        If players level is full, activate a random powerup
    */
    usePowerup() {

        // Only allow control to be active when moving (playing)
        if (this.moving) {
            //Check if the players level bar is full
            if (this.playerLevel == 5) {
                // Check if a powerup is already active
                if (!this.powerupActive) {

                    this.powerupActive = true;

                    // Add random weighting to the powerups
                    let num = Math.floor(Math.random() * (10 - 1) + 1);

                    if (num <= 2) {
                        this.demolish();
                    }
                    else if (num <= 5) {
                        this.foodFight();
                    }
                    else if (num <= 7) {
                        this.trim();
                    }
                    else {
                        this.freezeMode();
                    }

                }
            }
            else {
                // Alert the player that the powerup is not yet ready
                document.getElementById('powerupSegments').classList.add('shake')

                setTimeout(() => {
                    document.getElementById('powerupSegments').classList.remove('shake')
                }, 1000);
            }
        } else {
            return;
        }
    }

    /* 
        Powerup Logic: 
            - Demolish: Destroy a random number of walls on the board
            - Freeze Mode: Slowdown the snake by a random %
            - Food Fight: Spawn a random number of food on the board
            - Trim: Shorten the snake by a random amount

        All powerups add a short speed increase blocker meaning the players speed will not increase
        on food pickups while active - this prevents cancelling out of the slowdown effect 
    */
    demolish() {

        let amountToDestroy = Math.floor(Math.random() * (3 - 1) + 1);

        for (let i = 0; i < amountToDestroy; i++) {
            this.game.wall.clear();
        }

        let heading = document.getElementById('powerupHeading');
        heading.innerHTML = '🔨Demolish! 🔨'

        this.resetLevel();

        setTimeout(() => {
            heading.innerHTML = 'Powerup Charging...'
            this.powerupActive = false;
        }, 3000)
    }

    freezeMode() {

        // Store the current speed to reset back to once the effect wears off
        let prevSpeed = this.speed;

        // Generate a random number between 20 & 50
        let percentage = Math.floor(Math.random() * (50 - 20)) + 20;

        let newSpeed = this.speed + ((percentage / 100) * this.speed);

        this.updateSpeed(newSpeed)

        let heading = document.getElementById('powerupHeading');
        heading.innerHTML = '❄️ Freeze Mode! ❄️'

        this.resetLevel();

        setTimeout(() => {
            heading.innerHTML = 'Powerup Charging...'

            this.updateSpeed(prevSpeed);
            this.powerupActive = false;
        }, 10000)
    }

    foodFight() {

        let amountToSpawn = Math.floor(Math.random() * (4 - 1) + 1);

        for (let i = 0; i < amountToSpawn; i++) {
            this.game.food.spawn();
        }

        let heading = document.getElementById('powerupHeading');
        heading.innerHTML = '🍎 Food Fight! 🍎'

        this.resetLevel();

        setTimeout(() => {
            heading.innerHTML = 'Powerup Charging...'
            this.powerupActive = false;
        }, 3000)
    }

    trim() {

        let amountToTrim = Math.floor(Math.random() * (3 - 1) + 1);

        for (let i = 0; i < amountToTrim; i++) {
            if (this.tail.length > 1) {
                this.tail[this.tail.length - 1].classList.remove('snake');
                this.tail[this.tail.length - 1].classList.remove('head');
                this.tail.length--;
            }
        }

        let heading = document.getElementById('powerupHeading');
        heading.innerHTML = '✂️ Trim! ✂️'

        this.resetLevel();

        setTimeout(() => {
            heading.innerHTML = 'Powerup Charging...'
            this.powerupActive = false;
        }, 3000)
    }

    /*
        Handle logic when the snake eats food
    */
    eatFood(boardCell) {

        // Change the cell from food to snake
        boardCell.classList.remove('food');
        boardCell.classList.add('snake');

        this.tail[this.tail.length - 1].classList.remove('head');

        // Append the new cell onto the snake and increase the snakes length
        this.tail.push(boardCell);

        // Move the now larger snake into the next position
        this.updatePosition();

        // If the move is not valid, end the game
        if (!this.isValidMove()) {
            this.game.gameOver();
            return;
        }

        // Increase the players score and speed
        this.game.increaseScore(1);

        // Speed up the snake if a powerup is not active 
        if (!this.powerupActive) {
            this.updateSpeed(this.speed - 10);
        }

        // Increase the players level + powerup bar
        this.increaseLevel();

        // Every 3 score added to the player increases the difficulty
        if (this.game.score % 3 == 0) {
            this.increaseDifficulty();
        }

        // Spawn new food
        this.game.food.spawn();
    }

    /*
      Pause the snake's movement
    */
    pause() {
        clearTimeout(this.movementTimer);
        this.moving = false;
        this.game.controls.classList.add('paused');
    }

    /**
     * Reset the snake back to the initial defaults
     */
    reset() {

        this.tail[this.tail.length - 1].classList.remove('head');

        for (let i = 0; i < this.tail.length; i++) {
            this.tail[i].classList.remove('snake');
        }

        this.tail.length = 0;
        this.tailLength = 6;
        this.direction = 'up';
        this.speed = 160;
        this.moving = false;

        this.resetLevel();
        this.game.food.clearAll();

        this.init();

    }

}

class Wall {

    constructor(game) {
        this.game = game;
        this.boardCell = null;
        this.wallPositions = [];
    }

    /*
        Place the wall randomly on the board
    */
    spawn() {

        // Randomly generate the new position within the game board
        const xPos = Math.floor(Math.random() * SnakeGame.NUM_COLS);
        const yPos = Math.floor(Math.random() * SnakeGame.NUM_ROWS);

        this.boardCell = this.game.boardCells[yPos][xPos];

        // Check if the cell is occupied by the snake, another wall or food
        if (this.boardCell.classList.contains['snake'] || this.boardCell.classList.contains['wall'] || this.boardCell.classList.contains['food']) {
            this.spawn();
        }

        this.boardCell.classList.add('wall');

        // Track all wall positions for easy clearing in powerup / on game restart
        this.wallPositions.push({ xPos: xPos, yPos: yPos })
    }

    /*
        Clear the board of all walls
    */
    clearAll() {
        this.wallPositions.forEach((wall) => {
            this.game.boardCells[wall.yPos][wall.xPos].classList.remove('wall');
        })
    }

    /*
        Clear single wall
    */
    clear() {
        if (this.wallPositions.length >= 1) {
            let wall = this.wallPositions[this.wallPositions.length - 1];

            this.game.boardCells[wall.yPos][wall.xPos].classList.remove('wall');
            this.wallPositions.pop();
        } else {
            return;
        }
    }
}

class Food {

    constructor(game) {
        this.game = game;
        this.boardCell = null;
        this.foodPositions = [];
    }

    /**
     * Place the food randomly on the board, by adding the class 'food' to one of the cells
     */
    spawn() {

        // Randomly generate the new position within the game board
        const xPos = Math.floor(Math.random() * SnakeGame.NUM_COLS);
        const yPos = Math.floor(Math.random() * SnakeGame.NUM_ROWS);

        this.boardCell = this.game.boardCells[yPos][xPos];

        // Check if the food will spawn inside the snake, if so generate a new position
        if (this.boardCell.classList.contains['snake'] || this.boardCell.classList.contains['wall'] || this.boardCell.classList.contains['food']) {
            this.move();
        }

        this.boardCell.classList.add('food');
        this.foodPositions.push({ xPos: xPos, yPos: yPos })
    }

    // Clear food on game restart
    clearAll() {
        this.foodPositions.forEach((food) => {
            this.game.boardCells[food.yPos][food.xPos].classList.remove('food');
        })
    }
}
