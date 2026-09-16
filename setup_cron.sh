#!/bin/bash

# Setup script for Linux VM
# This script sets up the cron job for automatic league data updates

echo "🚀 Setting up Sleeper League Auto-Updater on Linux VM"
echo "=================================================="

# Check if we're on Linux
if [[ "$OSTYPE" != "linux-gnu"* ]]; then
    echo "⚠️  This script is designed for Linux. Current OS: $OSTYPE"
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Get current directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo "📁 Working directory: $SCRIPT_DIR"

# Check if required files exist
if [ ! -f "$SCRIPT_DIR/update_league_data.sh" ]; then
    echo "❌ update_league_data.sh not found!"
    exit 1
fi

if [ ! -f "$SCRIPT_DIR/sleeper_league_data.py" ]; then
    echo "❌ sleeper_league_data.py not found!"
    exit 1
fi

# Make scripts executable
chmod +x "$SCRIPT_DIR/update_league_data.sh"
echo "✅ Made update_league_data.sh executable"

# Setup Python virtual environment and install dependencies
echo "📦 Setting up Python virtual environment..."
VENV_PATH="$SCRIPT_DIR/venv"

# Create virtual environment if it doesn't exist
if [ ! -d "$VENV_PATH" ]; then
    echo "🔧 Creating virtual environment at $VENV_PATH..."
    python3 -m venv "$VENV_PATH" || {
        echo "❌ Failed to create virtual environment"
        echo "💡 Make sure python3-venv is installed: sudo apt install python3-venv"
        exit 1
    }
    echo "✅ Virtual environment created"
else
    echo "ℹ️  Virtual environment already exists"
fi

# Install Python dependencies in virtual environment
echo "📦 Installing Python dependencies in virtual environment..."
"$VENV_PATH/bin/pip" install requests || {
    echo "❌ Failed to install Python requests package"
    exit 1
}
echo "✅ Python dependencies installed in virtual environment"

# Set up environment variables
LEAGUE_ID="1389378463139373056"
echo "🔧 Setting up environment variables..."

# Add SLEEPER_LEAGUE_ID to .bashrc if not already there
if ! grep -q "SLEEPER_LEAGUE_ID" ~/.bashrc; then
    echo "export SLEEPER_LEAGUE_ID=$LEAGUE_ID" >> ~/.bashrc
    echo "✅ Added SLEEPER_LEAGUE_ID to ~/.bashrc"
else
    echo "ℹ️  SLEEPER_LEAGUE_ID already in ~/.bashrc"
fi

# Set for current session
export SLEEPER_LEAGUE_ID=$LEAGUE_ID

# Check for GitHub token
if [ -z "$SLEEPER_GITHUB_TOKEN" ]; then
    echo "⚠️  SLEEPER_GITHUB_TOKEN not found in environment"
    echo "📝 You need to set your GitHub Personal Access Token:"
    echo "   1. Create token at: https://github.com/settings/tokens"
    echo "   2. Give it 'repo' permissions"
    echo "   3. Set it with: export SLEEPER_GITHUB_TOKEN='your_token_here'"
    echo "   4. Add to ~/.bashrc: echo 'export SLEEPER_GITHUB_TOKEN=\"your_token_here\"' >> ~/.bashrc"
    echo ""
    read -p "Do you want to set SLEEPER_GITHUB_TOKEN now? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        read -p "Enter your GitHub Personal Access Token: " -s TOKEN
        echo
        export SLEEPER_GITHUB_TOKEN="$TOKEN"
        echo "export SLEEPER_GITHUB_TOKEN=\"$TOKEN\"" >> ~/.bashrc
        echo "✅ GitHub token set and added to ~/.bashrc"
    else
        echo "❌ Cannot proceed without GitHub token. Please set it manually and run this script again."
        exit 1
    fi
else
    echo "✅ SLEEPER_GITHUB_TOKEN found in environment"
fi

# Configure Git if not already configured
echo "🔧 Configuring Git..."
if ! git config user.name >/dev/null 2>&1; then
    git config user.name "Sleeper League Bot"
    git config user.email "sleeper-bot@noreply.github.com"
    echo "✅ Git user configuration set"
else
    echo "ℹ️  Git user already configured: $(git config user.name)"
fi

# Test the update script
echo "🧪 Testing the update script..."
if "$SCRIPT_DIR/update_league_data.sh"; then
    echo "✅ Update script test successful!"
else
    echo "❌ Update script test failed!"
    echo "Check the log file: $SCRIPT_DIR/update_league_data.log"
    exit 1
fi

# Set up cron jobs
echo "⏰ Setting up cron jobs..."

# Create cron job entries for specific times
# Live scores come straight from the Sleeper API in the browser, so the job only
# refreshes the snapshot (fallback data, player names, best unowned team).
CRON_JOBS=(
    "0 6 * * * $SCRIPT_DIR/update_league_data.sh >/dev/null 2>&1   # daily 6am"
    "0 13 * * 2 $SCRIPT_DIR/update_league_data.sh >/dev/null 2>&1  # Tuesday 1pm, after Sleeper finalizes the week"
)

# Remove any existing cron jobs for this script
echo "🧹 Removing any existing cron jobs for update_league_data.sh..."
crontab -l 2>/dev/null | grep -v "update_league_data.sh" | crontab -

# Add new cron jobs
echo "📅 Adding new cron schedule..."
CURRENT_CRONTAB=$(crontab -l 2>/dev/null)
for job in "${CRON_JOBS[@]}"; do
    CURRENT_CRONTAB="$CURRENT_CRONTAB"$'\n'"$job"
done
echo "$CURRENT_CRONTAB" | crontab -
echo "✅ Cron jobs added successfully!"

echo ""
echo "🎉 Setup Complete!"
echo "=================="
echo ""
echo "📋 Summary:"
echo "  • Update script: $SCRIPT_DIR/update_league_data.sh"
echo "  • Virtual environment: $VENV_PATH"
echo "  • Log file: $SCRIPT_DIR/update_league_data.log"
echo "  • Website: https://ryanroundhouse.github.io/sleeper/"
echo ""
echo "📅 Cron Schedule (Fantasy Football Optimized):"
echo "  • Monday 11:00 PM    - Post-MNF update"
echo "  • Sunday 4:00 PM     - Early games complete"
echo "  • Sunday 8:00 PM     - Late games complete"
echo "  • Sunday 11:00 PM    - SNF/final update"
echo "  • Thursday 11:00 PM  - Post-TNF update"
echo ""
echo "🔧 Manual Commands:"
echo "  • Run update now: $SCRIPT_DIR/update_league_data.sh"
echo "  • View logs: tail -f $SCRIPT_DIR/update_league_data.log"
echo "  • Edit cron: crontab -e"
echo "  • View cron: crontab -l"
echo ""
echo "🔧 Troubleshooting:"
echo "  • If cron fails with 'SLEEPER_GITHUB_TOKEN not set':"
echo "    1. Make sure token is in ~/.bashrc: grep SLEEPER_GITHUB_TOKEN ~/.bashrc"
echo "    2. Check cron logs: tail -f $SCRIPT_DIR/update_league_data.log"
echo "    3. Test manually: $SCRIPT_DIR/update_league_data.sh"
echo ""
echo "🚀 Your fantasy league data will now update automatically!"
