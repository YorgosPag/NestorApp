Get-ChildItem -LiteralPath 'C:\Nestor_Pagonis\src' -Recurse -Include '*.ts','*.tsx' -File |
  Where-Object {
    $_.FullName -notmatch '\\node_modules\\' -and
    $_.FullName -notmatch '\\config\\' -and
    $_.FullName -notmatch '\\types\\' -and
    $_.FullName -notmatch '\\data\\' -and
    $_.FullName -notmatch '\\debug\\' -and
    $_.Name -notmatch '\.d\.ts$' -and
    $_.Name -notmatch '\.test\.' -and
    $_.Name -notmatch '\.spec\.' -and
    $_.Name -notmatch '\.styles\.' -and
    $_.Name -notmatch '\.config\.' -and
    $_.Name -ne 'index.ts' -and
    $_.Name -ne 'index.tsx'
  } |
  ForEach-Object {
    $lines = (Get-Content -LiteralPath $_.FullName | Measure-Object -Line).Lines
    if ($lines -gt 500) {
      "{0}`t{1}" -f $lines, $_.FullName
    }
  } |
  Sort-Object { [int]($_ -split "`t")[0] } -Descending
