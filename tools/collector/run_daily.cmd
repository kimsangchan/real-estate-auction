@echo off
REM Daily collection entrypoint for Windows Task Scheduler (WP-11).
REM
REM ASCII only, on purpose. cmd.exe parses .cmd files in the OEM codepage (CP949 here),
REM not UTF-8, so Korean comments decode to garbage and break parsing. Korean notes for
REM this script live in README.md instead.
REM
REM Reads DATABASE_URL from the repo-root .env so no secret is stored in the repo.
REM Runs `daily --with-tenants`: the tenant table lives only in the notice PDF and is
REM readable from one week before the auction date until that date. Miss the window and
REM it is gone for good (WP-11 section 4-3). Items already scanned are skipped, so in
REM steady state this only costs requests for newly published items.
REM Migrations are NOT run here - schema changes are applied by hand after review.
setlocal
set "HERE=%~dp0"
set "ENVFILE=%HERE%..\..\.env"

if not exist "%ENVFILE%" (
  echo run_daily: %ENVFILE% not found 1>&2
  exit /b 2
)

for /f "usebackq eol=# tokens=1,* delims==" %%A in ("%ENVFILE%") do (
  if /i "%%A"=="DATABASE_URL" set "DATABASE_URL=%%B"
)

if not defined DATABASE_URL (
  echo run_daily: DATABASE_URL not set in .env 1>&2
  exit /b 2
)

cd /d "%HERE%"
".venv\Scripts\python.exe" -m collector daily --with-tenants >> "%HERE%daily.log" 2>&1
exit /b %ERRORLEVEL%
