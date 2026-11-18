@echo off
chcp 65001 >nul
title 로또 번호 생성기 - 자동 인쇄 설치 (csh2020.com)
powershell -NoProfile -ExecutionPolicy Bypass -Command "$s=[IO.File]::ReadAllText('%~f0',[Text.Encoding]::UTF8); $i=$s.IndexOf('#PS'+'-START'); Invoke-Expression $s.Substring($i)"
echo.
pause
exit /b

#PS-START
# 로또 번호 생성기 자동 인쇄 설치 (csh2020.com/lotto)
# 하는 일: 1) 이 PC에 연결된 프린터 찾기(없으면 Windows 프린터 추가 화면을 열어 연결 안내)
#          2) 실제 프린터를 기본 프린터로 정하기(물어본 뒤에만)
#          3) 바탕화면에 '로또번호생성기 (자동 인쇄)' 아이콘 만들기 - 이 아이콘으로 열면 인쇄 창 없이 기본 프린터로 바로 인쇄
# 바꾸는 것은 기본 프린터(동의 시)와 바탕화면 아이콘 하나뿐이다. 다른 프로그램을 내려받거나 설치하지 않는다.
$ErrorActionPreference = 'Continue'
$URL = 'https://csh2020.com/lotto?ap=1'
function Say($t, $c = 'Gray') { Write-Host $t -ForegroundColor $c }
$virtual = 'PDF|XPS|OneNote|Fax|FAX|팩스|Print to|Send To|Snagit|Adobe PDF'

Say ''
Say '==============================================' 'Cyan'
Say '  로또 번호 생성기 - 자동 인쇄 설치' 'Cyan'
Say '==============================================' 'Cyan'
Say ''

# 1) 프린터 찾기
$real = @()
for ($try = 1; $try -le 3; $try++) {
    $all = @(Get-CimInstance Win32_Printer)
    $real = @($all | Where-Object { $_.Name -notmatch $virtual })
    if ($real.Count -gt 0) { break }
    Say '[1/3] 연결된 프린터가 없습니다.' 'Yellow'
    Say '      프린터 전원을 켜고 USB 선을 꽂거나, 이 PC와 같은 와이파이에 연결해 주세요.'
    Say '      지금 Windows [프린터 및 스캐너] 화면을 엽니다. [장치 추가]를 누르면 Windows가 프린터를 찾아 자동으로 설치합니다.'
    Start-Process 'ms-settings:printers'
    Read-Host '      프린터가 추가되면 Enter 키를 누르세요'
}
if ($real.Count -eq 0) {
    Say '[1/3] 프린터를 찾지 못했습니다. 프린터 연결 뒤 이 설치 프로그램을 다시 실행해 주세요.' 'Red'
} else {
    Say '[1/3] 찾은 프린터:' 'Green'
    for ($k = 0; $k -lt $real.Count; $k++) {
        $p = $real[$k]; $st = @(); if ($p.Default) { $st += '기본' }; if ($p.WorkOffline) { $st += '오프라인' }
        Say ("      {0}. {1} {2}" -f ($k + 1), $p.Name, ($(if ($st) { '(' + ($st -join ', ') + ')' } else { '' })))
    }
}

# 2) 기본 프린터 정하기
$def = Get-CimInstance Win32_Printer -Filter 'Default=TRUE'
if ($real.Count -gt 0) {
    $defIsReal = $def -and ($def.Name -notmatch $virtual) -and -not $def.WorkOffline
    $pick = $null
    if ($defIsReal) {
        Say ("[2/3] 기본 프린터: {0}" -f $def.Name) 'Green'
        $a = Read-Host '      이 프린터로 인쇄합니다. 다른 프린터로 바꾸려면 번호를, 그대로 쓰려면 Enter'
        if ($a -match '^\d+$' -and [int]$a -ge 1 -and [int]$a -le $real.Count) { $pick = $real[[int]$a - 1] }
    } else {
        Say ("[2/3] 지금 기본 프린터는 '{0}'라서 종이로 인쇄되지 않습니다." -f $(if ($def) { $def.Name } else { '없음' })) 'Yellow'
        if ($real.Count -eq 1) {
            $a = Read-Host ("      '{0}'을(를) 기본 프린터로 정할까요? (Y/N)" -f $real[0].Name)
            if ($a -match '^[Yy예]') { $pick = $real[0] }
        } else {
            $a = Read-Host '      기본 프린터로 쓸 프린터 번호를 입력하세요'
            if ($a -match '^\d+$' -and [int]$a -ge 1 -and [int]$a -le $real.Count) { $pick = $real[[int]$a - 1] }
        }
    }
    if ($pick) {
        # Windows가 기본 프린터를 마음대로 바꾸지 않도록(설정 > 프린터 > 'Windows에서 기본 프린터 관리' 끄기)
        Set-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows NT\CurrentVersion\Windows' -Name 'LegacyDefaultPrinterMode' -Value 1 -Type DWord -ErrorAction SilentlyContinue
        $r = Invoke-CimMethod -InputObject $pick -MethodName SetDefaultPrinter
        if ($r.ReturnValue -eq 0) { Say ("      기본 프린터를 '{0}'(으)로 정했습니다." -f $pick.Name) 'Green' }
        else { Say '      기본 프린터를 바꾸지 못했습니다. 설정 > 프린터 및 스캐너에서 직접 [기본값으로 설정]을 눌러 주세요.' 'Red' }
    }
} else {
    Say '[2/3] 프린터가 없어 건너뜁니다.' 'Yellow'
}

# 3) 바탕화면 아이콘
$browser = @("${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe", "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
             "$env:ProgramFiles\Google\Chrome\Application\chrome.exe", "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
             "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $browser) {
    Say '[3/3] 엣지·크롬을 찾지 못해 아이콘을 만들지 못했습니다.' 'Red'
} else {
    $prof = Join-Path $env:LOCALAPPDATA 'csh2020-lotto-autoprint'
    $desk = [Environment]::GetFolderPath('Desktop')
    $lnk = Join-Path $desk '로또번호생성기 (자동 인쇄).lnk'
    $ws = New-Object -ComObject WScript.Shell
    $sc = $ws.CreateShortcut($lnk)
    $sc.TargetPath = $browser
    # --kiosk-printing: 인쇄 창 없이 기본 프린터로 바로 인쇄 / 따로 쓰는 프로필이라 이미 열린 브라우저와 섞이지 않음
    $sc.Arguments = "--kiosk-printing --user-data-dir=`"$prof`" --no-first-run --app=$URL"
    $sc.IconLocation = "$browser,0"
    $sc.Description = '로또 번호 생성기 - 인쇄 창 없이 기본 프린터로 바로 인쇄'
    $sc.Save()
    Say ("[3/3] 바탕화면에 '로또번호생성기 (자동 인쇄)' 아이콘을 만들었습니다.") 'Green'
}

Say ''
Say '설치가 끝났습니다.' 'Cyan'
Say ' - 바탕화면 [로또번호생성기 (자동 인쇄)] 아이콘으로 열고, 번호 생성 후 [용지 인쇄]를 누르면 바로 인쇄됩니다.'
Say ' - 인쇄 크기는 실제 크기(100%)로 나갑니다. 처음 한 장은 실물 용지와 크기를 비교해 보세요.'
Say ' - 판매점 용지를 프린터에 직접 넣어 찍을 때는 일반 인터넷 창에서 인쇄 창을 열어 수동 급지대를 고르세요.'
if ($browser -and (Read-Host '지금 생성기를 열까요? (Y/N)') -match '^[Yy예]') { Start-Process $lnk }
