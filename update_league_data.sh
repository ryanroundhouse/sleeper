#!/bin/bash

# Sleeper League Data Auto-Updater
# This script fetches the latest league data, commits changes, and pushes to GitHub
# Designed to run as a cron job for automatic updates

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="$SCRIPT_DIR/update_league_data.log"
LEAGUE_ID="${SLEEPER_LEAGUE_ID:-1264686617134628864}"  # Default to your league ID
VENV_PATH="$SCRIPT_DIR/venv"
PYTHON_CMD="$VENV_PATH/bin/python3"

# GitHub authentication using Personal Access Token
# Set SLEEPER_GITHUB_TOKEN environment variable with your GitHub Personal Access Token
SLEEPER_GITHUB_TOKEN="${SLEEPER_GITHUB_TOKEN:-}"

# Colors for output (if running interactively)
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    local level=$1
    shift
    local message="$@"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    # Log to file
    echo "[$timestamp] [$level] $message" >> "$LOG_FILE"
    
    # Also output to console if running interactively
    if [ -t 1 ]; then
        case $level in
            "ERROR")   echo -e "${RED}[$timestamp] [ERROR] $message${NC}" ;;
            "SUCCESS") echo -e "${GREEN}[$timestamp] [SUCCESS] $message${NC}" ;;
            "WARNING") echo -e "${YELLOW}[$timestamp] [WARNING] $message${NC}" ;;
            "INFO")    echo -e "${BLUE}[$timestamp] [INFO] $message${NC}" ;;
            *)         echo "[$timestamp] [$level] $message" ;;
        esac
    fi
}

# Error handling
set -e
trap 'log "ERROR" "Script failed at line $LINENO"' ERR

# Start logging
log "INFO" "Starting league data update process"
log "INFO" "Working directory: $SCRIPT_DIR"
log "INFO" "League ID: $LEAGUE_ID"

# Change to script directory
cd "$SCRIPT_DIR"

# Setup GitHub authentication using Personal Access Token
setup_git_auth() {
    if [ -n "$SLEEPER_GITHUB_TOKEN" ]; then
        log "INFO" "Using GitHub Personal Access Token for authentication"
        # Configure git to use token
        git remote set-url origin "https://${SLEEPER_GITHUB_TOKEN}@github.com/ryanroundhouse/sleeper.git"
    else
        log "ERROR" "SLEEPER_GITHUB_TOKEN environment variable not set!"
        log "ERROR" "Please set your GitHub Personal Access Token:"
        log "ERROR" "export SLEEPER_GITHUB_TOKEN='your_token_here'"
        exit 1
    fi
}

# Check if we're in a git repository
if [ ! -d ".git" ]; then
    log "ERROR" "Not in a git repository. Please run this script from the sleeper project directory."
    exit 1
fi

# Check if Python script exists
if [ ! -f "sleeper_league_data.py" ]; then
    log "ERROR" "sleeper_league_data.py not found in current directory"
    exit 1
fi

# Check if virtual environment exists
if [ ! -d "$VENV_PATH" ]; then
    log "ERROR" "Virtual environment not found at $VENV_PATH"
    log "ERROR" "Please run setup_cron.sh first to create the virtual environment"
    exit 1
fi

# Check if Python is available in virtual environment
if [ ! -f "$PYTHON_CMD" ]; then
    log "ERROR" "Python not found in virtual environment: $PYTHON_CMD"
    exit 1
fi

# Check if required Python packages are available
log "INFO" "Checking Python dependencies in virtual environment..."
if ! $PYTHON_CMD -c "import requests" 2>/dev/null; then
    log "WARNING" "requests package not found. Attempting to install..."
    "$VENV_PATH/bin/pip" install requests || {
        log "ERROR" "Failed to install requests package"
        exit 1
    }
fi

# Setup Git configuration
setup_git_config() {
    # Check if git user is configured
    if ! git config user.name >/dev/null 2>&1; then
        log "INFO" "Setting up Git user configuration..."
        git config user.name "Sleeper League Bot"
        git config user.email "sleeper-bot@noreply.github.com"
        log "SUCCESS" "Git user configuration set"
    fi
}

# Setup Git authentication
setup_git_auth
setup_git_config

# Pull latest changes from GitHub first
log "INFO" "Pulling latest changes from GitHub..."
if git pull origin main >> "$LOG_FILE" 2>&1; then
    log "SUCCESS" "Successfully pulled latest changes"
else
    log "WARNING" "Failed to pull latest changes, continuing with current version"
    # Don't exit here as we might be offline or have conflicts, but we can still update data
fi

# Store current git status
INITIAL_STATUS=$(git status --porcelain)

# Fetch latest league data
log "INFO" "Fetching latest league data..."
if $PYTHON_CMD sleeper_league_data.py "$LEAGUE_ID" >> "$LOG_FILE" 2>&1; then
    log "SUCCESS" "League data fetched successfully"
else
    log "ERROR" "Failed to fetch league data"
    exit 1
fi

# Check if there are any changes
CURRENT_STATUS=$(git status --porcelain)
if [ -z "$CURRENT_STATUS" ]; then
    log "INFO" "No changes detected. Nothing to commit."
    exit 0
fi

# Show what changed
log "INFO" "Changes detected:"
git status --short >> "$LOG_FILE"

# Add all changes
log "INFO" "Adding changes to git..."
git add --all

# Get current week from NFL state if available
CURRENT_WEEK=""
if [ -f "nfl_state.json" ]; then
    CURRENT_WEEK=$($PYTHON_CMD -c "
import json
try:
    with open('nfl_state.json', 'r') as f:
        data = json.load(f)
        print(data.get('week', ''))
except:
    pass
" 2>/dev/null)
fi

# Create commit message
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
if [ -n "$CURRENT_WEEK" ]; then
    COMMIT_MSG="Auto-update league data - Week $CURRENT_WEEK ($TIMESTAMP)"
else
    COMMIT_MSG="Auto-update league data ($TIMESTAMP)"
fi

# Commit changes
log "INFO" "Committing changes with message: $COMMIT_MSG"
if git commit -m "$COMMIT_MSG" >> "$LOG_FILE" 2>&1; then
    log "SUCCESS" "Changes committed successfully"
else
    log "ERROR" "Failed to commit changes"
    exit 1
fi

# Push to GitHub
log "INFO" "Pushing changes to GitHub..."
if git push origin main >> "$LOG_FILE" 2>&1; then
    log "SUCCESS" "Changes pushed to GitHub successfully"
    log "INFO" "Website will update automatically via GitHub Pages"
else
    log "ERROR" "Failed to push to GitHub"
    log "WARNING" "Changes are committed locally but not pushed to remote"
    exit 1
fi

# Clean up old log entries (keep last 100 lines)
if [ -f "$LOG_FILE" ]; then
    tail -n 100 "$LOG_FILE" > "${LOG_FILE}.tmp" && mv "${LOG_FILE}.tmp" "$LOG_FILE"
fi

log "SUCCESS" "League data update completed successfully!"
log "INFO" "Check your website at: https://ryanroundhouse.github.io/sleeper/"

# Optional: Send notification (uncomment if you want email notifications)
# echo "League data updated successfully at $(date)" | mail -s "Sleeper League Update" your-email@example.com

exit 0
