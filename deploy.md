# Deploying to an UpCloud VPS with nginx


## 1. Deploy future updates

For each update:

```bash
cd /opt/gifingie
git pull
bun install --frozen-lockfile
bun run build
bun run db:migrate
sudo systemctl restart gifingie
sudo systemctl reload nginx
```

Watch the logs after restarting:

```bash
sudo journalctl -u gifingie -f
```
