// instance.setTempToken = (dbid: string, tempToken: string) => {
//   if (debug) {
//     const existingToken = tempTokens.get(dbid);
//     if (!tempTokens.has(dbid)) {
//       console.log(`Adding token to tempTokens map`); // Log adding token to map
//       console.log(`QuickBase.js set temp token for: ${dbid}: ${tempToken}`); // Log setting a new temp token
//     } else if (existingToken !== tempToken) {
//       // The tempTokens map already has a token for the dbid
//       // but it doesn't match the token in QuickBase.js.
//       // Which means QuickBase.js generated a new token.
//       console.log(`QuickBase.js generating renewed temp token for: ${dbid}`);
//       console.log(`Updating tempTokens map with generated token`); // Log updating token in map
//       console.log(`QuickBase.js set temp token for: ${dbid}: ${tempToken}`); // Log setting renewed temp token
//     } else {
//       console.log(`QuickBase.js set temp token for: ${dbid}: ${tempToken}`); // Log setting temp token
//     }
//   }

//   // Update the tempTokens map and call the original setTempToken method
//   tempTokens.set(dbid, tempToken);
//   originalSetTempToken(dbid, tempToken);
//   return instance;
// };

//   if (
//     // check if the instance token is the same as the map token
//     currentInstanceToken === token &&
//     quickbaseService.tempTokens.get(dbid) === token
//   ) {
//     console.log(
//       `Token in qb matches the token in map: ${dbid}: ${token}`
//     );
//   } else {
//     // console.log(`Set the token for ${dbid}: ${token}`);
//     // This runs when the token is different from the map token
//     // we update the token on line 134
//     console.log(
//       `Token in qb doesn't match the token in map: ${dbid}: ${token}`
//     );
//     // Log setting the token for the dbid
//   }
