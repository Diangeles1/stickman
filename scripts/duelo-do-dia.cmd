@echo off
REM ============================================================
REM  O DUELO DO DIA, para o Agendador de Tarefas do Windows.
REM
REM  Existe porque o schtasks nao sabe ajustar PATH nem trocar de
REM  pasta: ele executa UM comando. Este arquivo e esse comando.
REM
REM  O node mora em D:\tools e nao esta no PATH do sistema (ver a
REM  memoria do projeto). Sem a linha abaixo a tarefa falha todo
REM  dia com "npx nao e reconhecido", e o canal fica mudo sem
REM  ninguem saber.
REM
REM  A saida vai para um arquivo: tarefa agendada nao tem terminal
REM  para onde imprimir, e sem registro um dia sem video e
REM  indistinguivel de um dia sem falha.
REM ============================================================
setlocal
set "RAIZ=%~dp0.."
set "PATH=D:\tools\node-v24.19.0-win-x64;%PATH%"
cd /d "%RAIZ%"
if not exist "out\diario" mkdir "out\diario"
echo. >> "out\diario\agendador.log"
echo ==== %DATE% %TIME% >> "out\diario\agendador.log"
call npx tsx scripts\diario.mts --publicar >> "out\diario\agendador.log" 2>&1
echo ---- fim, codigo %ERRORLEVEL% >> "out\diario\agendador.log"
endlocal
