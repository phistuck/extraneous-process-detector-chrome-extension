const HOST = "http://localhost:32190/",
      KILL_URL = `${HOST}kill?`,
      LIST_URL = `${HOST}list`,
      LIST_IDS_URL = `${HOST}list-ids?`,
      NEEDS_SECRET = 'Needs a secret',
      BAD_SECRET = 'Bad secret',
      BAD_STATUS = 'Bad status code',
      NO_SECRET = 'No secret',
      NETWORK_ERROR = "Could not fetch initial list.",
      CODES_PER_ERROR = {401: NO_SECRET, 403: BAD_SECRET, 412: NEEDS_SECRET};

let userDataDirectory = '',
    didDetermineUserDataDirectory = false,
    i = 0,
    allProcessIDs = [];

const relevantProcesses = [],
      relevantProcessSet = new Set(),
      potentiallyZombieProcesses = [],
      notificationIDs = [],
      credentials = {};
      
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
 return fetch(`${KILL_URL}${id}&${userDataDirectory}`, credentials);
}

function clean()
{
 potentiallyZombieProcesses.splice(0);
 allProcessIDs.splice(0);
}

function killZombieProcesses()
{
 const potentiallyZombieIDs =
        potentiallyZombieProcesses.map(({osProcessId: id}) => id)
         .filter(id => id);

 const potentiallyZombieSet = new Set();

 allProcessIDs
  .filter(id => !relevantProcesses.find(({osProcessId}) => osProcessId === id))
  .forEach(id => potentiallyZombieSet.add(id))

 return Promise.all(
         [...potentiallyZombieSet].map(killProcessByID))
         .then(clean)
}

function handleBadJSON(error)
{
 function setSecret()
 {
  credentials.headers = {'X-Secret': localStorage.secret};
 }

 function getNewSecret()
 {
  localStorage.secret = prompt('Secret?');
 }

 if (error.message !== NEEDS_SECRET && error.message !== BAD_SECRET)
 {
  return handleInitialListFetchError(error).catch(() => {});
 }

 if (!localStorage.secret || error.message === BAD_SECRET)
 {
  getNewSecret();
 }
 setSecret();
 fetchInitialList();
}

function handleInitialListFetchSuccess(response)
{
 if (response.ok)
 {
  return response.json();
 }
 throw new Error(CODES_PER_ERROR[response.status] || BAD_STATUS);
}

function fetchInitialList()
{
 notificationIDs.forEach(id => chrome.notifications.clear(id));
 notificationIDs.splice(0);
 fetch(LIST_URL, credentials)
  .then(handleInitialListFetchSuccess, handleInitialListFetchError)
  .then(determineUserDataDirectory, handleBadJSON);
}

function handleInitialListFetchError(error)
{
 if (error.message === NETWORK_ERROR)
 {
  // Already shown a notification.
  return Promise.reject();
 }

 let advisory = "";
 if (error.message === NEEDS_SECRET || error.message === BAD_SECRET)
 {
  advisory = "Enter the secret and click to try again.";
 }
 else if (error.message === NO_SECRET)
 {
  advisory = "A shared secret must be specified in the server command. Click to try again.";
 }
 else
 {
  advisory = "Start the server and click to try again."
 }
 chrome.notifications.create(
  {
   type: "basic",
   iconUrl: "icon.ico",
   title: "Could not fetch the initial process list.",
   message: advisory,
   requireInteraction: true
  },
  id => notificationIDs.push(id));

 return Promise.reject(new Error(NETWORK_ERROR));
}

chrome.notifications.onClicked.addListener(fetchInitialList);

function fetchAllProcessIDs()
{
 const url = `${LIST_IDS_URL}${userDataDirectory}`;
 return fetch(url, credentials)
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