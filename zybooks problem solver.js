// ==UserScript==
// @name         Zybooks Solver
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  Comprehensive Zybooks activity solver with UI controls. Handles animations, radio questions, and clickable questions.
// @author       DevGuyRash
// @match        *://*.zybooks.com/*
// @grant        none
// ==/UserScript==

/**
 * Main script wrapper using IIFE for encapsulation
 * Provides automated solving capabilities for various Zybooks activities
 */
(function() {
    'use strict';

    /**
     * Utility Functions
     */
    // Promise-based delay function for async operations
    const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

    // Generate random delay between min and max milliseconds for human-like behavior
    const randomDelay = (min, max) => Math.random() * (max - min) + min;

    /**
     * Configuration object for timing constants
     * @type {Object}
     */
    const CONFIG = {
        DELAYS: {
            MIN_BETWEEN_QUESTIONS: 500,
            MAX_BETWEEN_QUESTIONS: 2000,
            CHECK_INTERVAL: 100,
            ANIMATION_STEP_TIMEOUT: 35000,
            ANSWER_WAIT: 2000
        },
        MAX_RETRIES: 20
    };

    /**
     * Enum for question types
     * @readonly
     * @enum {string}
     */
    const QUESTION_TYPES = {
        ANIMATION: 'animations',
        RADIO: 'radio',
        CLICKABLE: 'clickable',
        SHORT_ANSWER: 'shortanswer',
        DRAG_DROP: 'dragdrop',
        RESET: 'reset',
        ALL: 'all'
    };

    /**
     * CSS Selectors for all interactive elements
     * @type {Object}
     */
    const SELECTORS = {
        // Animation-related selectors
        ANIMATION_CONTAINER: 'div[class*="interactive-activity-container"][class*="animation-player"]',
        CHEVRON: 'div[class*="zb-chevron"][class*="title-bar-chevron"]',
        SPEED_CHECKBOX: 'div[class*="speed-control"] input[type="checkbox"]',
        START_BUTTON: 'button[class*="start-button"]',
        PLAY_BUTTON: 'button[aria-label="Play"]',
        PAUSE_BUTTON: 'button[aria-label="Pause"]',
        PLAY_ICON_ROTATED: 'div[class*="play-button"][class*="rotate"]',
        
        // Question-related selectors
        QUESTION_CONTAINER: 'div[id^="ember"]:has(div.zb-radio-button).multiple-choice-question',
        RADIO_BUTTONS: 'div.zb-radio-button > input',
        CORRECT_ANSWER: 'div.correct',
        INCORRECT_ANSWER: 'div.incorrect',
        COMPLETED_QUESTION: 'div.grey',
        
        // Clickable question selectors
        CLICKABLE_CONTAINER: 'div.detect-answer-content-resource',
        CLICKABLE_QUESTION: 'div.detect-answer-question',
        CLICKABLE_BUTTONS: 'button.zb-button.grey.unclicked',
        CLICKABLE_CHEVRON: 'div.zb-chevron.question-chevron',
        
        // Short answer question selectors
        SHORT_ANSWER_CONTAINER: 'div.short-answer-content-resource',
        SHORT_ANSWER_QUESTION: 'div.question-set-question.short-answer-question',
        SHORT_ANSWER_TEXTAREA: 'textarea.zb-text-area',
        SHORT_ANSWER_CHECK: 'button.check-button',
        SHORT_ANSWER_SHOW: 'button.show-answer-button',
        SHORT_ANSWER_EXPLANATION: 'div.zb-explanation',
        SHORT_ANSWER_ANSWERS: 'div.answers span.forfeit-answer',
        
        // Drag and drop selectors
        DRAG_DROP_CONTAINER: 'div.definition-match-payload',
        DRAG_OPTIONS: 'li.unselected-term div.draggable-object',
        DROP_TARGETS: 'div.definition-row div.term-bucket:not(.populated)',
        EXPLANATION_DIV: 'div.definition-match-explanation',
        DRAGGED_OPTION: 'div.term-bucket.populated div.draggable-object',
        RESET_BUTTON: 'button.reset-button'
    };

    /**
     * Simulates a drag and drop operation between two elements
     * @param {Element} dragElement - The element to be dragged
     * @param {Element} dropTarget - The target element to drop onto
     * @description Creates and dispatches the necessary drag and drop events to simulate
     * a user dragging an element to a target. Used for Zybooks' drag and drop matching questions.
     */
    const simulateDragDrop = (dragElement, dropTarget) => {
        // Create drag start event
        const dragStart = new DragEvent('dragstart', {
            bubbles: true,
            cancelable: true,
            dataTransfer: new DataTransfer()
        });
        
        // Create drop event
        const drop = new DragEvent('drop', {
            bubbles: true,
            cancelable: true,
            dataTransfer: dragStart.dataTransfer
        });

        // Dispatch events in sequence
        dragElement.dispatchEvent(dragStart);
        dropTarget.dispatchEvent(drop);
    };

    /**
     * Checks and verifies the feedback state after a drag and drop operation
     * @param {Element} target - The target row element containing the feedback
     * @returns {Promise<boolean>} - Resolves to true if the match is correct, false otherwise
     * @description Implements a robust checking mechanism that:
     * 1. Waits for initial feedback to appear
     * 2. Verifies the feedback state multiple times to ensure stability
     * 3. Double-checks correct matches to avoid false positives
     * 4. Returns early on definitive incorrect matches
     */
    const waitForAndCheckFeedback = async (target) => {
        // Wait for initial feedback
        await delay(CONFIG.DELAYS.CHECK_INTERVAL);
        
        // Check multiple times to ensure feedback has stabilized
        for (let i = 0; i < 3; i++) {
            const explanation = target.querySelector(SELECTORS.EXPLANATION_DIV);
            if (!explanation) return false;
            
            if (explanation.classList.contains('correct')) {
                // Wait one more time to be absolutely sure
                await delay(CONFIG.DELAYS.CHECK_INTERVAL);
                // Check again to confirm it's still correct
                if (target.querySelector(SELECTORS.EXPLANATION_DIV)?.classList.contains('correct')) {
                    return true;
                }
            } else if (explanation.classList.contains('incorrect')) {
                return false;
            }
            
            await delay(CONFIG.DELAYS.CHECK_INTERVAL / 2);
        }
        
        return false;
    };

    /**
     * Checks if a target row has a correct match
     * @param {Element} row - The target row element to check
     * @returns {boolean} - Whether the row has a correct match
     * @description Examines the explanation div within a row to determine if it contains
     * a correct match. Used for initial state checking and verification.
     */
    const hasCorrectMatch = (row) => {
        const explanation = row.querySelector(SELECTORS.EXPLANATION_DIV);
        return explanation?.classList.contains('correct') || false;
    };

    /**
     * Processes a single drag and drop matching question
     * @param {Element} container - The container element for the question
     * @param {Function} shouldStop - Function that returns whether processing should stop
     * @param {Function} addLog - Function to add log messages
     * @param {boolean} forceMode - Whether to force processing regardless of completion state
     * @description Handles the complete solving process for a drag and drop matching question:
     * 1. Checks initial state and handles force mode
     * 2. Processes each target sequentially
     * 3. Tries options from both the bank and other populated buckets
     * 4. Verifies matches and tracks completion
     * 5. Provides detailed logging throughout the process
     */
    const handleDragDropQuestion = async (container, shouldStop, addLog, forceMode) => {
        // Track which targets have been filled correctly
        const completedTargets = new Set();
        
        // Check existing state
        const allTargets = Array.from(container.querySelectorAll('.definition-row'));
        let correctCount = 0;
        
        for (const target of allTargets) {
            if (hasCorrectMatch(target)) {
                completedTargets.add(target);
                correctCount++;
            }
        }
        
        // If all targets are correct and not in force mode, we're done
        if (correctCount === allTargets.length && !forceMode) {
            addLog('All matches are already correct!');
            return;
        }
        
        // If in force mode or some incorrect matches, reset everything
        if (forceMode || correctCount > 0) {
            const resetButton = container.querySelector('.reset-button');
            if (resetButton) {
                addLog(forceMode ? 'Force mode enabled, resetting matches...' : 'Some matches exist, resetting for fresh attempt...');
                resetButton.click();
                await delay(CONFIG.DELAYS.CHECK_INTERVAL);
                completedTargets.clear();
            }
        }

        while (true) {
            if (shouldStop()) {
                addLog('Stopping drag and drop solver...');
                return;
            }

            // Get all targets that haven't been completed yet
            const targets = Array.from(container.querySelectorAll('.definition-row'))
                .filter(row => !completedTargets.has(row));

            // Get available options from the term bank
            const optionBank = container.querySelector('.term-bank');
            const availableOptions = optionBank ? 
                Array.from(optionBank.querySelectorAll('li.unselected-term div.draggable-object')) : [];

            addLog(`Found ${availableOptions.length} options in bank and ${targets.length} unfilled targets`);

            // If no more targets or no options in bank, we're done
            if (targets.length === 0 || (availableOptions.length === 0 && !container.querySelector('.term-bucket.populated'))) {
                addLog('No more available targets or options');
                break;
            }

            // Try each available option in the current target
            const currentTarget = targets[0];
            const dropZone = currentTarget.querySelector('.term-bucket');
            let foundMatch = false;

            // First try options from the bank
            for (const option of availableOptions) {
                if (shouldStop()) return;

                const optionText = option.querySelector('span')?.textContent.trim() || option.textContent.trim();
                addLog(`Trying option from bank "${optionText}" in target ${targets.indexOf(currentTarget) + 1}`);
                
                // Simulate drag and drop
                simulateDragDrop(option, dropZone);
                
                // Wait for and check feedback
                const isCorrect = await waitForAndCheckFeedback(currentTarget);
                
                if (isCorrect) {
                    addLog('Correct match found and verified!');
                    completedTargets.add(currentTarget);
                    foundMatch = true;
                    // Wait a bit longer after a correct match
                    await delay(CONFIG.DELAYS.CHECK_INTERVAL);
                    break;
                }
                
                // Wait before trying next option
                await delay(CONFIG.DELAYS.CHECK_INTERVAL);
            }

            // If no match found in bank, try options that are in populated buckets
            if (!foundMatch) {
                const populatedBuckets = Array.from(container.querySelectorAll('.term-bucket.populated'))
                    .filter(bucket => !completedTargets.has(bucket.closest('.definition-row')));

                for (const bucket of populatedBuckets) {
                    if (shouldStop()) return;

                    const option = bucket.querySelector('.draggable-object');
                    if (!option) continue;

                    const optionText = option.querySelector('span')?.textContent.trim() || option.textContent.trim();
                    addLog(`Trying option from bucket "${optionText}" in target ${targets.indexOf(currentTarget) + 1}`);
                    
                    // Simulate drag and drop
                    simulateDragDrop(option, dropZone);
                    
                    // Wait for and check feedback
                    const isCorrect = await waitForAndCheckFeedback(currentTarget);
                    
                    if (isCorrect) {
                        addLog('Correct match found and verified!');
                        completedTargets.add(currentTarget);
                        foundMatch = true;
                        // Wait a bit longer after a correct match
                        await delay(CONFIG.DELAYS.CHECK_INTERVAL);
                        break;
                    }
                    
                    // Wait before trying next option
                    await delay(CONFIG.DELAYS.CHECK_INTERVAL);
                }
            }

            if (!foundMatch) {
                addLog('No correct match found for current target, moving to next question');
                break;
            }
        }
    };

    /**
     * Processes all drag and drop matching questions on the page
     * @param {boolean} forceMode - Whether to force processing regardless of completion state
     * @param {Function} shouldStop - Function that returns whether processing should stop
     * @param {Function} addLog - Function to add log messages
     * @description Main entry point for solving drag and drop questions:
     * 1. Finds all unique drag and drop questions on the page
     * 2. Processes each question sequentially
     * 3. Handles completion state and force mode
     * 4. Provides progress logging
     */
    const solveAllDragDropQuestions = async (forceMode = false, shouldStop = () => false, addLog = console.log) => {
        const containers = Array.from(document.querySelectorAll(SELECTORS.DRAG_DROP_CONTAINER))
            .filter((container, index, self) => 
                index === self.findIndex(c => c.getAttribute('content_resource_id') === container.getAttribute('content_resource_id'))
            );
        
        if (containers.length === 0) {
            addLog('No drag and drop questions found.');
            return;
        }

        addLog(`Found ${containers.length} drag and drop questions`);

        for (const container of containers) {
            if (shouldStop()) {
                addLog('Stopping drag and drop solver...');
                return;
            }

            addLog('Processing drag and drop question');
            await handleDragDropQuestion(container, shouldStop, addLog, forceMode);
            await delay(randomDelay(CONFIG.DELAYS.MIN_BETWEEN_QUESTIONS, CONFIG.DELAYS.MAX_BETWEEN_QUESTIONS));
        }
        
        addLog('Completed processing all drag and drop questions');
    };

    /**
     * Creates and manages the UI controls for the solver
     * Includes draggable panel, action selection, and output display
     */
    const createUI = () => {
        // Logging system for user feedback
        const logs = [];
        const addLog = (message) => {
            const timestamp = new Date().toLocaleTimeString();
            logs.push(`[${timestamp}] ${message}`);
            updateOutputPanel();
        };

        // Position UI below the toolbar
        const toolbar = document.querySelector('body > header');
        const initialTop = toolbar ? toolbar.offsetHeight + 10 : 60;

        // Create main container
        const container = document.createElement('div');
        container.style.cssText = `
            position: fixed;
            top: ${initialTop}px;
            right: 20px;
            background: white;
            padding: 15px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            z-index: 10000;
            font-family: Arial, sans-serif;
        `;

        // Create draggable header
        const dragHandle = document.createElement('div');
        dragHandle.style.cssText = `
            padding: 5px;
            margin: -15px -15px 10px -15px;
            background: #f8f9fa;
            border-radius: 8px 8px 0 0;
            cursor: move;
            text-align: center;
            font-weight: bold;
            border-bottom: 1px solid #dee2e6;
        `;
        dragHandle.textContent = 'Zybooks Solver';

        // Implement drag functionality
        let isDragging = false;
        let currentX;
        let currentY;
        let initialX;
        let initialY;

        dragHandle.addEventListener('mousedown', e => {
            isDragging = true;
            initialX = e.clientX - container.offsetLeft;
            initialY = e.clientY - container.offsetTop;
        });

        document.addEventListener('mousemove', e => {
            if (isDragging) {
                e.preventDefault();
                currentX = e.clientX - initialX;
                currentY = e.clientY - initialY;
                container.style.left = currentX + 'px';
                container.style.top = currentY + 'px';
                container.style.right = 'auto';
            }
        });

        document.addEventListener('mouseup', () => {
            isDragging = false;
        });

        // Create controls container
        const controlsContainer = document.createElement('div');
        controlsContainer.style.cssText = 'display: flex; flex-direction: column; gap: 10px;';

        // Create force mode toggle
        const forceModeContainer = document.createElement('div');
        forceModeContainer.style.cssText = 'display: flex; align-items: center; padding: 5px; background: #f8f9fa; border-radius: 4px;';
        
        const forceCheckbox = document.createElement('input');
        forceCheckbox.type = 'checkbox';
        forceCheckbox.id = 'force-mode';
        forceCheckbox.style.marginRight = '5px';
        
        const forceLabel = document.createElement('label');
        forceLabel.htmlFor = 'force-mode';
        forceLabel.textContent = 'Force Mode';
        forceLabel.style.fontSize = '14px';

        // Create action dropdown
        const dropdown = document.createElement('select');
        dropdown.style.cssText = 'padding: 8px; border-radius: 4px; border: 1px solid #ced4da; width: 100%;';
        const options = [
            { value: '', text: 'Select Action...' },
            { value: 'all', text: 'Solve All' },
            { value: 'animations', text: 'Run Animations' },
            { value: 'radio', text: 'Solve Radio Questions' },
            { value: 'clickable', text: 'Solve Clickable Questions' },
            { value: 'shortanswer', text: 'Solve Short Answer Questions' },
            { value: 'dragdrop', text: 'Solve Drag & Drop Questions' },
            { value: 'reset', text: 'Reset All Chevrons' }
        ];
        options.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt.value;
            option.textContent = opt.text;
            dropdown.appendChild(option);
        });

        // Create run/stop buttons
        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = 'display: flex; gap: 10px;';

        let isStopped = false;
        const runButton = document.createElement('button');
        runButton.textContent = 'Run';
        runButton.style.cssText = `
            padding: 8px 15px;
            background: #007bff;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            flex: 1;
        `;

        const stopButton = document.createElement('button');
        stopButton.textContent = 'Stop';
        stopButton.style.cssText = `
            padding: 8px 15px;
            background: #dc3545;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            flex: 1;
        `;

        // Create output panel
        const outputContainer = document.createElement('div');
        outputContainer.style.cssText = `
            margin-top: 10px;
            border-top: 1px solid #dee2e6;
            padding-top: 10px;
        `;

        const outputToggle = document.createElement('button');
        outputToggle.textContent = 'Show Output';
        outputToggle.style.cssText = `
            padding: 4px 8px;
            background: #6c757d;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            width: 100%;
        `;

        const outputPanel = document.createElement('div');
        outputPanel.style.cssText = `
            margin-top: 10px;
            max-height: 200px;
            overflow-y: auto;
            background: #f8f9fa;
            padding: 8px;
            border-radius: 4px;
            font-size: 12px;
            display: none;
        `;

        // Output panel toggle functionality
        let outputVisible = false;
        outputToggle.onclick = () => {
            outputVisible = !outputVisible;
            outputPanel.style.display = outputVisible ? 'block' : 'none';
            outputToggle.textContent = outputVisible ? 'Hide Output' : 'Show Output';
            if (outputVisible) updateOutputPanel();
        };

        const updateOutputPanel = () => {
            if (outputVisible) {
                outputPanel.innerHTML = logs.join('<br>');
                outputPanel.scrollTop = outputPanel.scrollHeight;
            }
        };

        /**
         * Processes all questions of a specific type
         * @param {QUESTION_TYPES} type - The type of questions to process
         * @param {boolean} forceMode - Whether to force processing regardless of completion
         * @param {Function} shouldStop - Function that returns whether processing should stop
         * @param {Function} addLog - Function to add log messages
         * @returns {Promise<void>}
         */
        const processQuestionType = async (type, forceMode, shouldStop, addLog) => {
            switch(type) {
                case QUESTION_TYPES.ANIMATION:
                    return solveAllAnimations(forceMode, shouldStop, addLog);
                case QUESTION_TYPES.RADIO:
                    return solveAllQuestions(forceMode, shouldStop, addLog);
                case QUESTION_TYPES.CLICKABLE:
                    return solveAllClickableQuestions(forceMode, shouldStop, addLog);
                case QUESTION_TYPES.SHORT_ANSWER:
                    return solveAllShortAnswerQuestions(forceMode, shouldStop, addLog);
                case QUESTION_TYPES.DRAG_DROP:
                    return solveAllDragDropQuestions(forceMode, shouldStop, addLog);
                case QUESTION_TYPES.RESET:
                    resetAllChevrons();
                    addLog('Reset all chevrons');
                    return Promise.resolve();
                default:
                    addLog(`Unknown question type: ${type}`);
                    return Promise.resolve();
            }
        };

        /**
         * Processes all question types concurrently
         * @param {boolean} forceMode - Whether to force processing regardless of completion
         * @param {Function} shouldStop - Function that returns whether processing should stop
         * @param {Function} addLog - Function to add log messages
         */
        const processAllQuestionTypes = async (forceMode, shouldStop, addLog) => {
            const types = [
                QUESTION_TYPES.ANIMATION,
                QUESTION_TYPES.RADIO,
                QUESTION_TYPES.CLICKABLE,
                QUESTION_TYPES.SHORT_ANSWER,
                QUESTION_TYPES.DRAG_DROP
            ];

            addLog('Starting all solvers concurrently...');
            
            // Create array of promises for each solver
            const solverPromises = types.map(async type => {
                try {
                    addLog(`Starting ${type} processing...`);
                    await processQuestionType(type, forceMode, shouldStop, addLog);
                    addLog(`Completed ${type} processing`);
                } catch (error) {
                    addLog(`Error in ${type} solver: ${error.message}`);
                }
            });

            // Run all solvers concurrently
            await Promise.all(solverPromises);
            addLog('All solvers completed');
        };

        // Update runButton.onclick to use new structure
        runButton.onclick = async () => {
            if (!dropdown.value) return;
            logs.length = 0;
            isStopped = false;
            stopButton.disabled = false;
            const forceMode = forceCheckbox.checked;
            addLog(`Starting ${dropdown.value} solver (Force Mode: ${forceMode})`);
            
            if (dropdown.value === QUESTION_TYPES.ALL) {
                await processAllQuestionTypes(forceMode, () => isStopped, addLog);
            } else {
                await processQuestionType(dropdown.value, forceMode, () => isStopped, addLog);
            }
            
            addLog('Operation completed');
        };

        stopButton.onclick = () => {
            isStopped = true;
            stopButton.disabled = true;
            addLog('Operation stopped by user');
        };

        // Assemble UI components
        forceModeContainer.appendChild(forceCheckbox);
        forceModeContainer.appendChild(forceLabel);
        buttonContainer.appendChild(runButton);
        buttonContainer.appendChild(stopButton);
        outputContainer.appendChild(outputToggle);
        outputContainer.appendChild(outputPanel);
        controlsContainer.appendChild(dropdown);
        controlsContainer.appendChild(forceModeContainer);
        controlsContainer.appendChild(buttonContainer);
        container.appendChild(dragHandle);
        container.appendChild(controlsContainer);
        container.appendChild(outputContainer);
        document.body.appendChild(container);
    };

    /**
     * Resets all chevron indicators to their incomplete state
     */
    const resetAllChevrons = () => {
        const allChevrons = document.querySelectorAll('div[class*="zb-chevron"][class*="title-bar-chevron"], div[class*="zb-chevron"][class*="question-chevron"]');
        allChevrons.forEach(chevron => {
            chevron.classList.remove('check', 'orange', 'filled');
            chevron.classList.add('grey', 'chevron-outline');
            chevron.setAttribute('aria-label', 'Activity not completed');
        });
    };

    /**
     * Handles a single animation container
     * @param {Element} animationContainer - The container element for the animation
     * @param {boolean} forceMode - Whether to force processing regardless of completion state
     * @param {Function} addLog - Function to add log messages
     * @returns {Promise<boolean>} - Whether the animation completed successfully
     */
    const handleAnimation = async (animationContainer, forceMode, addLog) => {
        const checkCompletion = () => {
            if (forceMode) return false;
            const chevron = animationContainer.querySelector(SELECTORS.CHEVRON);
            return chevron && (chevron.classList.contains('filled') || chevron.classList.contains('orange'));
        };

        if (checkCompletion() && !forceMode) {
            addLog('Animation already completed, skipping...');
            return true;
        }

        // Check if we need to reset from rewind state
        const playButton = animationContainer.querySelector(SELECTORS.PLAY_BUTTON);
        if (playButton && playButton.querySelector(SELECTORS.PLAY_ICON_ROTATED)) {
            addLog('Animation in rewind state, resetting...');
            playButton.click(); // This acts as a stop button
            await delay(CONFIG.DELAYS.CHECK_INTERVAL);
        }

        // Enable 2x speed if available
        const speedCheckbox = animationContainer.querySelector(SELECTORS.SPEED_CHECKBOX);
        if (speedCheckbox && !speedCheckbox.checked) {
            addLog('Enabling 2x speed...');
            speedCheckbox.click();
            await delay(CONFIG.DELAYS.CHECK_INTERVAL);
        }

        // Start the animation
        const startButton = animationContainer.querySelector(SELECTORS.START_BUTTON);
        if (startButton) {
            addLog('Clicking start button...');
            startButton.click();
            await delay(CONFIG.DELAYS.CHECK_INTERVAL);
        }

        // Process animation steps
        let attempts = 0;
        const startTime = Date.now();
        
        while ((!checkCompletion() || forceMode) && attempts < CONFIG.MAX_RETRIES * 2) {
            if (Date.now() - startTime > CONFIG.DELAYS.ANIMATION_STEP_TIMEOUT) {
                addLog('Animation exceeded maximum time, moving on...');
                break;
            }

            const currentPlayButton = animationContainer.querySelector(SELECTORS.PLAY_BUTTON);
            if (currentPlayButton) {
                if (currentPlayButton.querySelector(SELECTORS.PLAY_ICON_ROTATED)) {
                    addLog('Animation reached end, resetting...');
                    currentPlayButton.click(); // Stop the animation
                    await delay(CONFIG.DELAYS.CHECK_INTERVAL);
                    
                    const newStartButton = animationContainer.querySelector(SELECTORS.START_BUTTON);
                    if (newStartButton) {
                        addLog('Restarting animation...');
                        newStartButton.click();
                        await delay(CONFIG.DELAYS.CHECK_INTERVAL);
                    }
                } else {
                    addLog('Clicking play button...');
                    currentPlayButton.click();
                    attempts++;
                }
            }
            
            await delay(CONFIG.DELAYS.CHECK_INTERVAL);
        }

        return checkCompletion() || forceMode;
    };

    /**
     * Processes all animations on the page
     * @param {boolean} forceMode - Whether to force processing regardless of completion state
     * @param {Function} shouldStop - Function that returns whether processing should stop
     * @param {Function} addLog - Function to add log messages
     */
    const solveAllAnimations = async (forceMode = false, shouldStop = () => false, addLog = console.log) => {
        const animationContainers = Array.from(document.querySelectorAll(SELECTORS.ANIMATION_CONTAINER));
        
        if (animationContainers.length === 0) {
            addLog('No animation elements found.');
            return;
        }

        addLog(`Found ${animationContainers.length} animation containers`);

        const animationsToProcess = forceMode ? 
            animationContainers : 
            animationContainers.filter(container => !isAnimationCompleted(container, forceMode));
        
        addLog(`Processing ${animationsToProcess.length} animations`);

        await Promise.all(animationsToProcess.map(async container => {
            if (shouldStop()) {
                addLog('Stopping animation solver...');
                return;
            }
            addLog('Processing animation container');
            return handleAnimation(container, forceMode, addLog);
        }));
    };

    /**
     * Handles a single clickable question
     * @param {Element} questionElement - The question element to process
     * @param {Function} shouldStop - Function that returns whether processing should stop
     * @param {Function} addLog - Function to add log messages
     * @param {boolean} forceMode - Whether to force processing regardless of completion state
     */
    const handleClickableQuestion = async (questionElement, shouldStop, addLog, forceMode) => {
        const buttons = Array.from(questionElement.querySelectorAll(SELECTORS.CLICKABLE_BUTTONS));
        const questionText = questionElement.querySelector('.question').textContent.trim();
        addLog(`Processing question: ${questionText.substring(0, 50)}...`);

        if (!buttons || buttons.length === 0) {
            addLog('No clickable buttons found in question');
            return;
        }

        addLog(`Found ${buttons.length} clickable options`);

        for (const button of buttons) {
            if (shouldStop()) {
                addLog('Stopping clickable question solver...');
                return;
            }

            // Skip if button was already tried
            if (button.classList.contains('clicked')) {
                continue;
            }

            const buttonText = button.textContent.trim();
            addLog(`Trying option: ${buttonText}`);
            button.click();
            
            // Wait for response
            let waitTime = 0;
            while (waitTime < CONFIG.DELAYS.ANSWER_WAIT) {
                // Check if this button was correct
                if (button.classList.contains('correct')) {
                    addLog('Correct answer found!');
                    return;
                }
                
                // Check if this button was incorrect
                if (button.classList.contains('incorrect')) {
                    addLog('Incorrect answer, trying next option');
                    await delay(CONFIG.DELAYS.CHECK_INTERVAL);
                    break;
                }
                
                await delay(CONFIG.DELAYS.CHECK_INTERVAL);
                waitTime += CONFIG.DELAYS.CHECK_INTERVAL;
            }
        }
    };

    /**
     * Processes all clickable questions on the page
     * @param {boolean} forceMode - Whether to force processing regardless of completion state
     * @param {Function} shouldStop - Function that returns whether processing should stop
     * @param {Function} addLog - Function to add log messages
     */
    const solveAllClickableQuestions = async (forceMode = false, shouldStop = () => false, addLog = console.log) => {
        const containers = Array.from(document.querySelectorAll(SELECTORS.CLICKABLE_CONTAINER))
            .filter((container, index, self) => 
                index === self.findIndex(c => c.getAttribute('content_resource_id') === container.getAttribute('content_resource_id'))
            );
        
        if (containers.length === 0) {
            addLog('No clickable questions found.');
            return;
        }

        addLog(`Found ${containers.length} question containers`);

        for (const container of containers) {
            if (shouldStop()) {
                addLog('Stopping clickable questions solver...');
                return;
            }

            const questions = Array.from(container.querySelectorAll(SELECTORS.CLICKABLE_QUESTION));
            addLog(`Processing ${questions.length} questions in container`);

            for (const question of questions) {
                if (shouldStop()) return;
                
                const chevron = question.querySelector(SELECTORS.CLICKABLE_CHEVRON);
                if (forceMode || !chevron || !chevron.classList.contains('filled')) {
                    await handleClickableQuestion(question, shouldStop, addLog, forceMode);
                    await delay(randomDelay(CONFIG.DELAYS.MIN_BETWEEN_QUESTIONS, CONFIG.DELAYS.MAX_BETWEEN_QUESTIONS));
                } else {
                    addLog('Question already completed, skipping...');
                }
            }
        }
        
        addLog('Completed processing all clickable questions');
    };

    /**
     * Processes all radio button questions on the page
     * @param {boolean} forceMode - Whether to force processing regardless of completion state
     * @param {Function} shouldStop - Function that returns whether processing should stop
     * @param {Function} addLog - Function to add log messages
     */
    const solveAllQuestions = async (forceMode = false, shouldStop = () => false, addLog = console.log) => {
        const questionElements = Array.from(document.querySelectorAll(SELECTORS.QUESTION_CONTAINER));
        
        if (questionElements.length === 0) {
            addLog('No radio questions found.');
            return;
        }

        addLog(`Found ${questionElements.length} radio questions`);

        // Filter out completed questions unless in force mode
        const questionsToProcess = forceMode ? 
            questionElements : 
            questionElements.filter(element => element.querySelector(SELECTORS.COMPLETED_QUESTION));
        
        addLog(`Processing ${questionsToProcess.length} radio questions`);

        for (const element of questionsToProcess) {
            if (shouldStop()) {
                addLog('Stopping radio question solver...');
                return;
            }
            await clickUntilCorrect(element, addLog);
            const delayDuration = randomDelay(CONFIG.DELAYS.MIN_BETWEEN_QUESTIONS, CONFIG.DELAYS.MAX_BETWEEN_QUESTIONS);
            addLog(`Waiting ${delayDuration.toFixed(2)}ms before next question`);
            await delay(delayDuration);
        }
    };

    /**
     * Clicks radio buttons until the correct answer is found
     * @param {Element} element - The question element
     * @param {Function} addLog - Function to add log messages
     */
    const clickUntilCorrect = async (element, addLog) => {
        const radioButtons = element.querySelectorAll(SELECTORS.RADIO_BUTTONS);
        if (!radioButtons || radioButtons.length === 0) {
            addLog('No radio buttons found in question');
            return;
        }

        addLog(`Found ${radioButtons.length} radio buttons`);
        
        for (const radioButton of radioButtons) {
            addLog('Trying radio button option');
            radioButton.click();
            await delay(CONFIG.DELAYS.CHECK_INTERVAL);

            // Wait for response with timeout
            let waitTime = 0;
            while (waitTime < CONFIG.DELAYS.ANSWER_WAIT) {
                const correct = element.querySelector(SELECTORS.CORRECT_ANSWER);
                const incorrect = element.querySelector(SELECTORS.INCORRECT_ANSWER);
                
                if (correct) {
                    addLog('Correct answer found');
                    return;
                } else if (incorrect) {
                    addLog('Incorrect answer, trying next option');
                    break;
                }
                
                await delay(CONFIG.DELAYS.CHECK_INTERVAL);
                waitTime += CONFIG.DELAYS.CHECK_INTERVAL;
            }
        }
        
        addLog('Completed processing radio question');
    };

    /**
     * Processes all short answer questions on the page
     * @param {boolean} forceMode - Whether to force processing regardless of completion state
     * @param {Function} shouldStop - Function that returns whether processing should stop
     * @param {Function} addLog - Function to add log messages
     */
    const solveAllShortAnswerQuestions = async (forceMode = false, shouldStop = () => false, addLog = console.log) => {
        // Get unique containers using Set and filter out duplicates by ID
        const containers = Array.from(document.querySelectorAll(SELECTORS.SHORT_ANSWER_CONTAINER))
            .filter((container, index, self) => 
                index === self.findIndex(c => c.getAttribute('content_resource_id') === container.getAttribute('content_resource_id'))
            );
        
        if (containers.length === 0) {
            addLog('No short answer questions found.');
            return;
        }

        addLog(`Found ${containers.length} short answer containers`);

        // Process containers sequentially to avoid race conditions
        for (const container of containers) {
            if (shouldStop()) {
                addLog('Stopping short answer solver...');
                return;
            }

            const questions = container.querySelectorAll(SELECTORS.SHORT_ANSWER_QUESTION);
            addLog(`Processing ${questions.length} questions in container`);

            // Process questions within container sequentially
            for (const question of questions) {
                if (shouldStop()) return;
                await handleShortAnswerQuestion(question, shouldStop, addLog, forceMode);
                await delay(randomDelay(CONFIG.DELAYS.MIN_BETWEEN_QUESTIONS, CONFIG.DELAYS.MAX_BETWEEN_QUESTIONS));
            }
        }
    };

    /**
     * Handles a single short answer question
     * @param {Element} questionElement - The question element to process
     * @param {Function} shouldStop - Function that returns whether processing should stop
     * @param {Function} addLog - Function to add log messages
     * @param {boolean} forceMode - Whether to force processing regardless of completion state
     * @returns {Promise<void>}
     */
    const handleShortAnswerQuestion = async (questionElement, shouldStop, addLog, forceMode) => {
        const chevron = questionElement.querySelector(SELECTORS.CLICKABLE_CHEVRON);
        if (!forceMode && chevron && chevron.classList.contains('filled')) {
            addLog('Question already completed, skipping...');
            return;
        }

        const showAnswerButton = questionElement.querySelector(SELECTORS.SHORT_ANSWER_SHOW);
        const textArea = questionElement.querySelector(SELECTORS.SHORT_ANSWER_TEXTAREA);
        const checkButton = questionElement.querySelector(SELECTORS.SHORT_ANSWER_CHECK);

        if (!showAnswerButton || !textArea || !checkButton) {
            addLog('Missing required elements, skipping question');
            return;
        }

        // Click show answer first time
        addLog('Clicking show answer first time...');
        showAnswerButton.click();
        await delay(CONFIG.DELAYS.CHECK_INTERVAL);

        // Click show answer second time
        addLog('Clicking show answer second time...');
        showAnswerButton.click();
        await delay(CONFIG.DELAYS.CHECK_INTERVAL * 2); // Give more time for answers to appear

        // Get the explanation div and check for answers
        const explanation = questionElement.querySelector(SELECTORS.SHORT_ANSWER_EXPLANATION);
        if (!explanation || !explanation.textContent.toLowerCase().includes('answer')) {
            addLog('No answer section found, skipping question');
            return;
        }

        // Get all possible answers
        const answerElements = explanation.querySelectorAll(SELECTORS.SHORT_ANSWER_ANSWERS);
        if (answerElements.length === 0) {
            addLog('No answers found, skipping question');
            return;
        }

        // Try each answer until one works
        for (const answerElement of answerElements) {
            if (shouldStop()) {
                addLog('Stopping short answer solver...');
                return;
            }

            const answer = answerElement.textContent.trim();
            addLog(`Trying answer: ${answer}`);
            
            // Type the answer
            textArea.value = answer;
            textArea.dispatchEvent(new Event('input', { bubbles: true }));
            await delay(CONFIG.DELAYS.CHECK_INTERVAL);

            // Click check
            checkButton.click();
            await delay(CONFIG.DELAYS.CHECK_INTERVAL);

            // Wait for response
            let waitTime = 0;
            const maxWaitTime = 2000;
            
            while (waitTime < maxWaitTime) {
                const currentChevron = questionElement.querySelector(SELECTORS.CLICKABLE_CHEVRON);
                if (currentChevron && currentChevron.classList.contains('filled')) {
                    addLog('Correct answer found!');
                    return;
                }
                await delay(CONFIG.DELAYS.CHECK_INTERVAL);
                waitTime += CONFIG.DELAYS.CHECK_INTERVAL;
            }
        }
    };

    // Initialize the script when the page loads
    window.addEventListener('load', () => {
        console.log("Zybooks Solver script loaded and running...");
        createUI();
    });
})();