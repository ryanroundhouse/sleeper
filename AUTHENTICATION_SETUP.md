# 🔐 Authentication Setup for Automated Git Operations

Since your SSH key requires a passphrase, you need to set up authentication for cron jobs using a GitHub Personal Access Token.

## 🎯 GitHub Personal Access Token Setup

This is the most reliable method for automated scripts:

### Step 1: Create a Personal Access Token

1. Go to GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Click "Generate new token (classic)"
3. Give it a name like "Sleeper League Automation"
4. Set expiration (recommend 1 year)
5. Select scopes: **`repo`** (full repository access)
6. Click "Generate token"
7. **Copy the token immediately** (you won't see it again!)

### Step 2: Set Environment Variable on Linux VM

```bash
# Add to ~/.bashrc
echo 'export SLEEPER_GITHUB_TOKEN="your_token_here"' >> ~/.bashrc
source ~/.bashrc

# Or set for current session
export SLEEPER_GITHUB_TOKEN="your_token_here"
```

### Step 3: Test the Setup

```bash
# The update script will automatically use the token
./update_league_data.sh
```


---

## 🧪 Testing Your Setup

Test your token setup:

```bash
# Test the update script
./update_league_data.sh

# Check the logs
tail -f update_league_data.log

# Verify cron job
crontab -l
```

## 🔧 Troubleshooting

### "Authentication failed" Error
- Token might be expired or have wrong permissions
- Regenerate token with `repo` scope
- Make sure SLEEPER_GITHUB_TOKEN environment variable is set

### Cron Job Not Running
- Check cron logs: `grep CRON /var/log/syslog`
- Ensure full paths in cron job
- Make sure SLEEPER_GITHUB_TOKEN is in ~/.bashrc for cron access

---

## 📞 Need Help?

Check the logs first:
```bash
tail -f update_league_data.log
```

Common issues and solutions are logged with helpful error messages.
