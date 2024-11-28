# Zybooks Problem Solver

A JavaScript-based automation tool designed to help solve various types of problems in Zybooks interactive learning platform.

## Features

- **Animation Handling**: Automatically runs and completes animation sequences
- **Radio Button Questions**: Solves multiple choice questions with radio button selections
- **Clickable Questions**: Handles interactive questions requiring specific element clicks
- **Short Answer Questions**: Automatically fills in short answer questions
- **Drag & Drop Matching**: Solves drag and drop matching questions
- **Force Mode**: Option to re-solve already completed questions
- **Solve All**: Ability to solve all question types on a page concurrently
- **UI Controls**: Draggable interface with action selection dropdown
- **Progress Logging**: Detailed feedback about solving progress

## Installation

### Option 1: Tampermonkey (Recommended)

1. Install the Tampermonkey browser extension:
   - [Chrome Web Store](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
   - [Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/)
   - [Edge Add-ons](https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd)

2. Click on the Tampermonkey icon and select "Create a new script"

3. Copy the contents of `zybooks problem solver.js` and paste it into the editor

4. Save the script (Ctrl+S or File -> Save)

5. Navigate to any Zybooks page - the solver interface will automatically appear in the top-right corner

### Option 2: Console (Not Recommended)

1. Open your browser's developer tools (F12)
2. Copy the contents of `zybooks problem solver.js`
3. Paste the code into the console while on a Zybooks page
4. The solver interface will appear in the top-right corner of the page
   
Note: Using the console method requires re-pasting the code each time you reload the page. For persistent usage, please use the Tampermonkey method.

## Usage

### Basic Usage

1. Navigate to any Zybooks page containing interactive elements
2. Select the desired action from the dropdown menu:
   - Solve All
   - Run Animations
   - Solve Radio Questions
   - Solve Clickable Questions
   - Solve Short Answer Questions
   - Solve Drag & Drop Questions
   - Reset All Chevrons
3. Click "Run" to execute the selected action

### Force Mode

Toggle "Force Mode" to:
- Re-solve already completed questions
- Reset and re-attempt questions
- Override completion status checks

### Interface Controls

- **Drag**: Click and hold the top bar to reposition the interface
- **Minimize**: Click the minimize button to collapse the interface
- **Force Mode**: Toggle button for forcing question resolution
- **Action Select**: Dropdown menu for selecting solving action
- **Run Button**: Executes the selected action
- **Stop Button**: Halts the current operation
- **Log Window**: Shows progress and status messages

## Supported Question Types

### Animations
- Handles step-by-step animations
- Supports variable-length animation sequences
- Waits for animation completion before proceeding

### Radio Button Questions
- Identifies correct answers
- Handles multiple choice questions
- Supports questions with multiple radio groups

### Clickable Questions
- Processes interactive click-based questions
- Handles multiple clickable elements
- Supports sequence-dependent clicks

### Short Answer Questions
- Automatically fills in text answers
- Handles multiple input fields
- Supports answer verification

### Drag & Drop Matching
- Solves matching questions
- Verifies correct matches
- Handles complex multi-step matching
- Supports reset and retry functionality

## Technical Details

### Key Components

- **Event Simulation**: Creates and dispatches synthetic browser events
- **State Management**: Tracks completion status and progress
- **Async Processing**: Handles timing and sequencing
- **Error Handling**: Robust error detection and recovery
- **UI Management**: Draggable and collapsible interface

### Performance Features

- Concurrent question processing
- Efficient DOM traversal
- Smart completion detection
- Optimized timing delays
- Minimal resource usage

## Notes

- This tool is for educational purposes only
- Use responsibly and in accordance with your institution's policies
- Some features may require adjustments based on Zybooks updates
- Performance may vary based on browser and system capabilities

## Contributing

Feel free to submit issues and enhancement requests!

## License

This project is licensed under the MIT License - see the LICENSE file for details. 