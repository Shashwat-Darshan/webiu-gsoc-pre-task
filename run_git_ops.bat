@echo off
REM Step 1: git status
echo === Step 1: git status ===
git --no-pager status --short

REM Step 2: git add
echo.
echo === Step 2: git add Tsk1 ===
git add Tsk1

REM Step 3: git commit
echo.
echo === Step 3: git commit ===
git commit -m "feat(task1): finalize scalable GitHub aggregation design" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"

REM Step 4: git log
echo.
echo === Step 4: git log ===
git --no-pager log --oneline -1

REM Final status
echo.
echo === Final Status ===
git --no-pager status --short
