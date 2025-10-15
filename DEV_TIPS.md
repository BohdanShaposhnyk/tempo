# Development Tips

## Port Already in Use (EADDRINUSE)

### Problem

When you stop the dev server with `Ctrl+C` (or `Cmd+C`), sometimes the Node process doesn't fully terminate, leaving port 3000 occupied.

### Quick Solutions

**Option 1: Use the restart script** (Recommended)
```bash
npm run restart
```
This automatically kills any process on port 3000 and starts the dev server.

**Option 2: Kill then start**
```bash
npm run kill          # Kill process on port 3000
npm run start:dev     # Start dev server
```

**Option 3: Manual kill**
```bash
lsof -ti:3000 | xargs kill -9
npm run start:dev
```

**Option 4: Find and kill by PID**
```bash
# Find processes
ps aux | grep "node.*tempo\|nest start" | grep -v grep

# Kill by PID
kill -9 <PID>
```

## Available Scripts

### Development

```bash
npm run start:dev     # Start with hot reload
npm run restart       # Kill port 3000 + start dev server
npm run kill          # Kill process on port 3000
npm run start:debug   # Start with debugger
```

### Production

```bash
npm run build         # Compile TypeScript
npm run start:prod    # Run compiled code
```

### Code Quality

```bash
npm run lint          # Run ESLint with auto-fix
npm run format        # Format code with Prettier
```

### Testing

```bash
npm test              # Run unit tests
npm run test:watch    # Run tests in watch mode
npm run test:cov      # Run with coverage
npm run test:e2e      # Run end-to-end tests
```

## Common Issues

### 1. EADDRINUSE Error

**Symptom:** `Error: listen EADDRINUSE: address already in use :::3000`

**Solution:**
```bash
npm run restart
```

### 2. Process Won't Die

If `Ctrl+C` doesn't stop the process:

```bash
# List all Node processes
ps aux | grep node

# Force kill specific PID
kill -9 <PID>
```

### 3. Multiple Processes Running

Check for zombie processes:

```bash
# Find all Node processes for this project
ps aux | grep tempo

# Kill all of them
pkill -9 -f "tempo"
```

### 4. Port Still in Use After Kill

Wait a few seconds for the OS to release the port, or use a different port:

```bash
PORT=3001 npm run start:dev
```

## Best Practices

### Starting Development

1. **First time:**
   ```bash
   npm install
   npm run start:dev
   ```

2. **Subsequent starts:**
   ```bash
   npm run restart
   ```

### Stopping Development

1. **Normal stop:** Press `Ctrl+C` (or `Cmd+C`)
2. **If port issues:** Use `npm run restart` next time

### Before Committing

```bash
npm run lint          # Fix linting issues
npm run format        # Format code
npm run build         # Ensure it compiles
npm test              # Run tests
```

## Hot Reload

The dev server (`npm run start:dev`) watches for file changes and automatically reloads:

- ✅ **TypeScript files** - Auto-compiled and reloaded
- ✅ **Config files** - Reloaded on change
- ❌ **package.json** - Requires manual restart
- ❌ **.env files** - Requires manual restart

If hot reload isn't working:
```bash
npm run restart
```

## Debugging

### Enable Debug Logging

The app uses NestJS Logger with configurable levels. Check logs for:

```
[PollerService] Found RUJI action at height 12345, txID: ABC123...
[DetectorService] [OPPORTUNITY] 2025-10-13T... | THOR.RUJI -> BTC.BTC | ...
```

### Debug in VS Code

Add to `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug NestJS",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "start:debug"],
      "console": "integratedTerminal",
      "restart": true,
      "port": 9229
    }
  ]
}
```

Then press F5 to start debugging.

### Check Health

```bash
curl http://localhost:3000/health
```

Should return:
```json
{
  "status": "ok",
  "info": {
    "thorchain": {
      "status": "up",
      "poller": "running",
      "lastProcessedHeight": 23232768
    }
  }
}
```

## Monitoring

### Watch Logs

Development mode shows all logs in the console. Look for:

- **Poller activity:** `[PollerService] Found RUJI action...`
- **Stream swaps:** `[DetectorService] [OPPORTUNITY]...`
- **Errors:** `[ERROR]...`

### Monitor API Calls

All Midgard API calls are logged at debug level:

```
[MidgardService] Fetching 20 recent RUJI actions
```

### Check Processing

Health endpoint shows last processed height:

```bash
# Watch health endpoint
watch -n 2 curl -s http://localhost:3000/health | jq
```

Height should increment every ~6 seconds.

## Performance

### Typical Resource Usage

- **Memory:** ~50-100 MB
- **CPU:** <1% (idle), ~5% (active polling)
- **Network:** ~30 KB per 6 seconds (~5 KB/s)

### If Performance Issues

1. **High CPU:** Check for infinite loops in logs
2. **High memory:** Restart the service
3. **Slow API:** Check Midgard API status
4. **Missing actions:** Increase fetch limit in `poller.service.ts`

## Environment Variables

Create a `.env` file (not tracked in git):

```env
PORT=3000
MIDGARD_API_URL=https://midgard.ninerealms.com
RUJI_TOKEN=THOR.RUJI
LOG_LEVEL=debug
```

**Note:** Changes to `.env` require restart:
```bash
npm run restart
```

## Quick Reference

| Command | Description |
|---------|-------------|
| `npm run restart` | Kill port 3000 + start dev |
| `npm run kill` | Kill process on port 3000 |
| `npm run start:dev` | Start dev server |
| `npm run build` | Compile TypeScript |
| `npm run lint` | Fix linting issues |
| `npm run format` | Format code |
| `npm test` | Run tests |

## Troubleshooting Checklist

- [ ] Port 3000 available? → `npm run kill`
- [ ] Dependencies installed? → `npm install`
- [ ] Code compiles? → `npm run build`
- [ ] API accessible? → `curl https://midgard.ninerealms.com/v2/health`
- [ ] Health endpoint working? → `curl http://localhost:3000/health`
- [ ] Seeing RUJI actions? → Check logs for `[PollerService] Found RUJI action`

## Getting Help

If issues persist:

1. Check logs for detailed error messages
2. Review documentation in `README.md`
3. Check THORChain/Midgard API status
4. Ensure you're using Node.js 18+

## Tips for Smooth Development

✅ **Always use `npm run restart`** instead of `npm run start:dev` after stopping  
✅ **Check health endpoint** to verify service is running correctly  
✅ **Monitor logs** for errors and opportunities  
✅ **Use hot reload** - just save files, don't restart  
✅ **Lint before commit** - run `npm run lint`  

This keeps development smooth and avoids port conflicts!

