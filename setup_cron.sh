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

# Install Python dependencies
echo "📦 Installing Python dependencies..."
python3 -m pip install --user requests || {
    echo "❌ Failed to install Python requests package"
    exit 1
}
echo "✅ Python dependencies installed"

# Set up environment variables
LEAGUE_ID="1264686617134628864"
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

# Test the update script
echo "🧪 Testing the update script..."
if "$SCRIPT_DIR/update_league_data.sh"; then
    echo "✅ Update script test successful!"
else
    echo "❌ Update script test failed!"
    echo "Check the log file: $SCRIPT_DIR/update_league_data.log"
    exit 1
fi

# Set up cron job
echo "⏰ Setting up cron job..."

# Create cron job entry
CRON_JOB="0 */6 * * * $SCRIPT_DIR/update_league_data.sh >/dev/null 2>&1"

# Check if cron job already exists
if crontab -l 2>/dev/null | grep -q "update_league_data.sh"; then
    echo "ℹ️  Cron job already exists"
else
    # Add cron job
    (crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -
    echo "✅ Cron job added successfully!"
fi

echo ""
echo "🎉 Setup Complete!"
echo "=================="
echo ""
echo "📋 Summary:"
echo "  • Update script: $SCRIPT_DIR/update_league_data.sh"
echo "  • Log file: $SCRIPT_DIR/update_league_data.log"
echo "  • Cron schedule: Every 6 hours"
echo "  • Website: https://ryanroundhouse.github.io/sleeper/"
echo ""
echo "🔧 Manual Commands:"
echo "  • Run update now: $SCRIPT_DIR/update_league_data.sh"
echo "  • View logs: tail -f $SCRIPT_DIR/update_league_data.log"
echo "  • Edit cron: crontab -e"
echo "  • View cron: crontab -l"
echo ""
echo "⏰ Cron Schedule Options:"
echo "  • Every 6 hours: 0 */6 * * *"
echo "  • Daily at 6 AM: 0 6 * * *"
echo "  • Twice daily: 0 6,18 * * *"
echo "  • Every hour: 0 * * * *"
echo ""
echo "🚀 Your fantasy league data will now update automatically!"
