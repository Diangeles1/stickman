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
set "CODIGO=%ERRORLEVEL%"
echo ---- fim, codigo %CODIGO% >> "out\diario\agendador.log"
REM ============================================================
REM  O CODIGO DE SAIDA TEM QUE CHEGAR AO AGENDADOR.
REM
REM  Sem a linha final abaixo este .cmd devolvia o codigo do
REM  ultimo `echo`, que e sempre 0. Em 14/10 o produtor terminou
REM  em 1 porque o envio falhou, o log registrou "codigo 1" -- e
REM  o Agendador de Tarefas anotou "Ultimo resultado: 0".
REM
REM  Quem olha o painel do Windows em vez do log via sucesso num
REM  dia em que o canal nao recebeu post. E o mesmo defeito que
REM  diario.mts tinha com o envio: a falha existia e nao chegava
REM  a ninguem. Registrar nao basta; tem que PROPAGAR.
REM ============================================================
endlocal & exit /b %CODIGO%
