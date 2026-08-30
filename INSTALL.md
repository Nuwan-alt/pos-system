# Installing the POS System on a New Computer

A complete, from-zero setup guide for getting Highland Kottawa POS running on
the shop owner's computer. Assumes a brand-new Windows machine with nothing
installed yet.

---

## Part 1 — Install the prerequisites

Download and install these three (all need internet access, one time only):

1. **Git** — https://git-scm.com/download/win
   Run the installer, default options are fine.

2. **Node.js (LTS version)** — https://nodejs.org
   This also installs `npm`. Default options are fine.

3. **XAMPP** — https://www.apachefriends.org/download.html
   During install, you only need the **MySQL** component checked
   (Apache/PHP/phpMyAdmin can stay checked too — phpMyAdmin is genuinely
   useful for Part 3 below; you can uncheck things like Tomcat/Perl you
   won't use).

Reboot after installing — a clean habit after Node/Git installs on Windows,
avoids PATH issues.

---

## Part 2 — Get the code

Open **PowerShell** (Start menu → type "PowerShell") and run:

```powershell
cd C:\
git clone -b bar-code <your-github-repo-url> POS-system
cd POS-system
```

Replace `<your-github-repo-url>` with your actual GitHub URL, including
credentials/token if it's a private repo.

`-b bar-code` checks out the **bar-code** branch, which adds barcode scanner
support on top of everything in `main`. We're trying this branch first on the
shop's hardware since barcode scanner behavior can vary.

**If the barcode scanner doesn't work on this computer**, fall back to `main`
(everything else — cashier login, inventory, reports, etc. — is identical):

```powershell
cd C:\POS-system
git checkout main
Remove-Item -Recurse -Force client\dist
```

Then re-run `start-pos.bat` (Part 6) — it rebuilds the frontend automatically
since `client\dist` is now missing, and starts the server from `main`'s code.
No database changes are needed either way; the passwords and data you've
already set up carry over untouched.

---

## Part 3 — Start MySQL and create the database

1. Open **XAMPP Control Panel** (Start menu) and click **Start** next to
   MySQL. It should turn green.
2. Click **Admin** next to MySQL — this opens **phpMyAdmin** in your browser.
3. Click the **Import** tab at the top.
4. Click **Choose File**, navigate to `C:\POS-system\server\db\schema.sql`,
   select it.
5. Scroll down, click **Go**.

That creates the `pos_db` database with all tables and seed data (default
products, cashiers, and login passwords) in one shot. Leave XAMPP's MySQL on
its **default port (3306)** — no need to touch its config.

---

## Part 4 — Configure the app

In `C:\POS-system\server`, copy `.env.example` to a new file named `.env`
(same folder), and open `.env` in Notepad. Make sure it reads exactly:

```
PORT=5001
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=pos_db
```

Only `DB_PORT` needs changing from the example — from `3307` to `3306`,
since this fresh XAMPP install uses its normal default port, not the
non-standard one the original dev laptop needed to dodge a conflicting
MySQL install.

---

## Part 5 — Install dependencies

Still in PowerShell:

```powershell
cd C:\POS-system\server
npm install
```

This downloads the backend's packages (takes a minute or two — needs
internet). You do **not** need to run `npm install` in `client/` yourself —
`start-pos.bat` does that automatically the first time it runs.

---

## Part 6 — First run

Double-click `C:\POS-system\start-pos.bat`.

A window will appear and walk through: confirming MySQL is reachable,
building the frontend (first run only — takes a minute), starting the
server, then opening your browser to the app automatically. Leave the
window open (it can be minimized); closing it stops the server.

---

## Part 7 — Log in and change the default passwords

- **Admin password:** `admin123`
- **Cashier password:** `cash123`

Log in as admin, go to **Settings**, and change both passwords immediately —
these defaults are public knowledge (they're sitting in this exact guide).

---

## Part 8 — Make it shop-owner-friendly

- Right-click `start-pos.bat` → **Send to → Desktop (create shortcut)**.
  Rename the shortcut to something like "Open POS".
- Optional, for "just turn on the computer and it's ready": press `Win+R`,
  type `shell:startup`, Enter — this opens the Startup folder. Copy the
  desktop shortcut into it. The POS will now launch automatically every
  time the computer boots.

---

## Troubleshooting quick reference

- **"Cannot connect to server" on login** — MySQL isn't actually reachable
  on the port `.env` says. Re-check `DB_PORT` in `.env` matches what XAMPP
  is actually using (Control Panel shows the port next to MySQL).
- **Made a backend code change and it's not taking effect** — the server
  needs a restart to pick up file changes; close `start-pos.bat`'s window
  and re-run it.
- **`npm install` fails** — check the shop computer actually has internet
  access at that moment; it's the only step in this whole guide that needs
  it (everything after that runs fully offline).
- **Barcode scanner doesn't work / need to fall back to `main`** — see the
  callout at the end of Part 2 above (`git checkout main`, delete
  `client\dist`, re-run `start-pos.bat`).
