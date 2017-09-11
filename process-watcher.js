const HOST = "http://localhost:32190/",
      KILL_URL = `${HOST}kill?`,
      LIST_URL = `${HOST}list`,
      LIST_IDS_URL = `${HOST}list-ids?`;

let userDataDirectory = '',
    didDetermineUserDataDirectory = false,
    i = 0,
    allProcessIDs = [];

const relevantProcesses = [],
      relevantProcessSet = new Set(),
      potentiallyZombieProcesses = [],
      notificationIDs = [];
      
function determineUserDataDirectory(list)
{
 const ownedProcess =
        list.find(process =>
         relevantProcesses.find(relevantProcess =>
          relevantProcess.profile &&
          relevantProcess.osProcessId === process.ProcessId));
 if (!ownedProcess)
 {
  setTimeout(fetchInitialList, 10000);
  return;
 }

 const userDataDirectoryMatches =
        ownedProcess.CommandLine.match(/user-data-dir=([^ ]+?)(?: .+)?$/);
 if (userDataDirectoryMatches && userDataDirectoryMatches.length > 1)
 {
  userDataDirectory = userDataDirectoryMatches[1].replace(/"/g, "");
 }
 didDetermineUserDataDirectory = true;
}

function addProcess(process)
{
 if (!relevantProcessSet.has(process.osProcessId))
 {
  relevantProcesses.push(process);
  relevantProcessSet.add(process.osProcessId);
 }
}

function markAsPotentiallyZombie(processID)
{
 console.log(processID);
 const processIndex = relevantProcesses.findIndex(({id}) => id === processID);
 if (processIndex === -1)
 {
  return;
 }
 relevantProcessSet.delete(relevantProcesses[processIndex].osProcessId);
 potentiallyZombieProcesses.push(relevantProcesses.splice(processIndex, 1)[0]);
}

function killProcessByID(id)
{
 return fetch(`${KILL_URL}${id}&${userDataDirectory}`);
}

function clean()
{
 potentiallyZombieProcesses.splice(0);
 allProcessIDs.splice(0);
}

function killZombieProcesses()
{
 const potentiallyZombieIDs =
        new Set(potentiallyZombieProcesses.map(({osProcessId: id}) => id));
 allProcessIDs
  .filter(
   id => !relevantProcesses.find(({osProcessId}) => osProcessId === id))
  .forEach(id => potentiallyZombieIDs.add(id))

 return Promise.all(
         [...potentiallyZombieIDs].map(killProcessByID))
         .then(clean)
}

function fetchInitialList()
{
 notificationIDs.forEach(id => chrome.notifications.clear(id));
 notificationIDs.splice(0);
 fetch(LIST_URL)
  .then(response => response.json())
  .catch(handleInitialListFetchError)
  .then(determineUserDataDirectory);
}

function handleInitialListFetchError()
{
 chrome.notifications.create(
  {
   type: "basic",
   iconUrl: "icon.ico",
   title: "Could not fetch the initial process list.",
   message: "Start the server and click to try again.",
   requireInteraction: true
  },
  id => notificationIDs.push(id));

 return Promise.reject(new Error("Could not fetch initial list."));
}

chrome.notifications.onClicked.addListener(fetchInitialList);

function fetchAllProcessIDs()
{
 const url = `${LIST_IDS_URL}${userDataDirectory}`;
 return fetch(url)
         .then(response => response.json())
         .then(ids => allProcessIDs = ids);
}

function processProcesses()
{
 if (!didDetermineUserDataDirectory)
 {
  return;
 }

 ++i;
 let promise = Promise.resolve()
 if (i % 2)
 {
  promise = promise.then(killZombieProcesses);
 }
 else
 {
  promise.then(fetchAllProcessIDs);
 }
}

function iterateProcesses(processes)
{
 [...Object.values(processes)].forEach(addProcess);
 fetchInitialList();
}

setInterval(processProcesses, 10000);


chrome.processes.onCreated.addListener(addProcess);
chrome.processes.onExited.addListener(markAsPotentiallyZombie);
chrome.processes.getProcessInfo([], false, iterateProcesses);