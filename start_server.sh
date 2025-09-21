#!/bin/bash

# Sleeper League Web Server Starter
# This script starts a simple HTTP server to serve the static HTML files

# Default port
PORT=8080

# Help function
show_help() {
    echo "Sleeper League Web Server Starter"
    echo ""
    echo "Usage: $0 [PORT]"
    echo ""
    echo "Arguments:"
    echo "  PORT    Port number to use (default: 8080)"
    echo ""
    echo "Examples:"
    echo "  $0          # Start server on port 8080"
    echo "  $0 8000     # Start server on port 8000"
    echo ""
    echo "Make sure you've run the data fetching script first:"
    echo "  python sleeper_league_data.py [LEAGUE_ID]"
    exit 0
}

# Check for help flags
if [ "$1" = "-h" ] || [ "$1" = "--help" ]; then
    show_help
fi

# Check if a port was provided as an argument
if [ $# -eq 1 ]; then
    # Validate that the argument is a number
    if ! [[ "$1" =~ ^[0-9]+$ ]]; then
        echo "Error: Port must be a number"
        echo "Use '$0 --help' for usage information"
        exit 1
    fi
    PORT=$1
fi

# Check if the port is already in use
if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null ; then
    echo "Port $PORT is already in use. Trying to find an available port..."
    
    # Find an available port starting from the requested port
    for ((i=$PORT; i<=$PORT+10; i++)); do
        if ! lsof -Pi :$i -sTCP:LISTEN -t >/dev/null ; then
            PORT=$i
            break
        fi
    done
    
    if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null ; then
        echo "Could not find an available port between $1 and $(($1+10))"
        exit 1
    fi
    
    echo "Using port $PORT instead"
fi

echo "Starting web server on port $PORT..."
echo "Open your browser to: http://localhost:$PORT"
echo ""
echo "Available pages:"
echo "  - Team Rosters: http://localhost:$PORT/index.html"
echo "  - Player Points: http://localhost:$PORT/sleeper_web_interface.html"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

# Start the server
python3 -m http.server $PORT
