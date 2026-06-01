@echo off
cd /d "%~dp0backend"
go build -o server.exe .
server.exe