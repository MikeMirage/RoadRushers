import { estimateLeaderboard } from './ranking-estimate.js';
self.onmessage=({data})=>{try{self.postMessage({entries:estimateLeaderboard(data)});}catch(error){self.postMessage({error:error.message});}};
