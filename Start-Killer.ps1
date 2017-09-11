# This is a simple web server that kills Chrome renderer processes.
# This is a modified version of
# https://gist.github.com/19WAS85/5424431

function Load-Packages
{
 param ([string] $directory = 'Packages')
 $assemblies =
  Get-ChildItem $directory -Recurse -Filter '*.dll' | Select -Expand FullName
 foreach ($assembly in $assemblies)
 {
  [System.Reflection.Assembly]::LoadFrom($assembly)
 }
}

function Is-Chrome-Renderer-Process
{
 param ($process, [string]$userDataDirectory = '', [bool]$hasUser = $TRUE)
 if ($process)
 {
  if ($process.Name -eq 'chrome.exe')
  {
   $commandLine = $process.CommandLine
   if ($commandLine -and
       ($commandLine.LastIndexOf('\chrome.exe" --type=renderer') -ne -1))
   {
    if ($userDataDirectory)
    {
     if ($commandLine.LastIndexOf($userDataDirectory) -ne -1)
     {
      return $TRUE
     }
    }
    elseif ($hasUser)
    {
     return $TRUE
    }
    else
    {
     if ($commandLine.LastIndexOf('--user-data-dir') -eq -1)
     {
      return $TRUE
     }
    }
   }
  }
 }
 return $FALSE
}

function Get-Chrome-Renderer-Processes
{
 $results =
  Get-WmiObject Win32_Process -Filter "name = 'chrome.exe'" |
  Select-Object Name, CommandLine, ProcessId

 $list = @()
 for ($i = 0; $i -lt $results.length; $i++)
 {
  $process = $results[$i]
  if (Is-Chrome-Renderer-Process -process $process)
  {
   $list += $process
  }
 }
 $output = ConvertTo-Json -InputObject $list -Compress
 Write-Output $output
}

function Get-Chrome-Renderer-Process-IDs-With-Profile
{
 param ([string] $userDataDirectory)

 $results =
  Get-WmiObject Win32_Process -Filter "name = 'chrome.exe'" |
  Select-Object Name, CommandLine, ProcessId
  
 $hasUser = $FALSE
 if ($userDataDirectory)
 {
  $hasUser = $TRUE
 }

 $list = @()
 for ($i = 0; $i -lt $results.length; $i++)
 {
  $process = $results[$i]
  $isRenderer =
   Is-Chrome-Renderer-Process -process $process `
    -userDataDirectory $userDataDirectory -hasUser $hasUser

  if ($isRenderer)
  {
   $list += $process.ProcessId
  }
 }
 $output = ConvertTo-Json -InputObject $list -Compress
 Write-Output $output
}

function Kill-By-ProcessID-And-Profile
{
 Param ([string]$processIDString, [string] $userDataDirectory = '')
 if ($processIDString -eq '0')
 {
  return 500
 }
 [int]$processID = 0
 [bool]$result = [int]::TryParse($processIDString, [ref]$processID)
 if ($result)
 {
  $process =
   Get-WmiObject Win32_Process -Filter "ProcessID = $processID" |
   Select-Object Name, CommandLine
   
  $isRenderer =
   Is-Chrome-Renderer-Process -process $process `
    -userDataDirectory $userDataDirectory -hasUser $TRUE

  if ($isRenderer)
  {
   Stop-Process -Id $processID
   return 200
  }
  else
  {
   return 404
  }
 }
 else
 {
  return 500
 }
}

Load-Packages

$url = 'http://localhost:32190/'
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($url)
$listener.Start()

Write-Host "Listening at $url..."

while ($listener.IsListening)
{
 $context = $listener.GetContext()
 $request = $context.Request
 $requestUrl = $request.Url
 $response = $context.Response


 Write-Host ''
 Write-Host "> $requestUrl"
 
 $origin = ''
 if ($request.Headers.Contains('Origin'))
 {
  $origin += $request.Headers.GetValues('Origin')[0];
 }

 if ($origin.LastIndexOf('chrome-extension://') -ne 0)
 {
  Write-Host 'Bad host. Blocked.'
  $response.Close()
  continue
 }

 $response.AppendHeader("Access-Control-Allow-Origin", $origin)
 
 $pathComponent = $requestUrl.LocalPath.SubString(1)
 $queryComponent = ''
 if ($requestUrl.Query)
 {
  $queryComponent = [System.Net.WebUtility]::UrlDecode($requestUrl.Query.Substring(1))
 }

 $content = ''

 if ($pathComponent -eq 'list')
 {
  $content += Get-Chrome-Renderer-Processes
 }
 elseif ($pathComponent -eq 'list-ids')
 {
  $content += Get-Chrome-Renderer-Process-IDs-With-Profile -userDataDirectory $queryComponent
 }
 elseif ($pathComponent -eq 'favicon.ico')
 {
  $content += ''
 }
 elseif ($pathComponent -eq 'kill')
 {
  $parameters = $queryComponent.Split('&')
  if ($parameters.Length -ne 2)
  {
   $content += 'Misssing parameter(s).'
   $response.StatusCode = 400
  }
  else
  {
   $result = Kill-By-ProcessID-And-Profile -processIDString $parameters[0] -userDataDirectory $parameters[1]

   if ($result -eq 400)
   {
    $content += 'Bad process ID.'
   }
   elseif ($result -eq 404)
   {
    $content += 'Could not find the process.'
   }
   elseif ($result -eq 200)
   {
    $content += 'Attempted killing the process.'
   }
   else
   {
    $result = 500
   }
   $response.StatusCode = $result
  }
 }

 $buffer = [System.Text.Encoding]::UTF8.GetBytes($content)
 $response.ContentLength64 = $buffer.Length
 $response.OutputStream.Write($buffer, 0, $buffer.Length)
 
 $response.Close()

 $responseStatus = $response.StatusCode
 Write-Host "< $responseStatus"
}