cd /opt/gifingie
git pull
bun install --frozen-lockfile
bun run build
bun run db:migrate
sudo systemctl restart gifingie
sudo systemctl reload nginx
sudo journalctl -u gifingie -f

