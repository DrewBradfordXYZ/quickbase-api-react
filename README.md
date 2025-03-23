# quickbase-api-react

## Issues

This project ran into difficulties handling concurrency and was abandoned. It works but is really hacky.

I created a Typescript API client from scratch to solve this problem. https://github.com/DrewBradfordXYZ/quickbase-js

## Description

A React hook wrapper for [/tflanagan/node-quickbase](https://github.com/tflanagan/node-quickbase) providing token management, logging, and environment-specific behavior for the [QuickBase JSON RESTful API](https://developer.quickbase.com/). Written in TypeScript.

This project takes the [/tflanagan/node-quickbase](https://github.com/tflanagan/node-quickbase) library and attempts to make it accessible in React. It retains access to the original method signatures for API requests. And uses the autoRenewTempTokens feature to regenerate temporary tokens after the 5 min lifespan expires.

## Prerequisites

- React that supports hooks. Version `16.8` or higher.
- A QuickBase account. A free [builder account](https://www.quickbase.com/builder-program) will work.

## Install

```bash
# Install library
npm install --save quickbase-api-react
# Install peerDependancy if not installed already.
npm install --save quickbase
```

## Uninstall

```bash
# Remove library
npm uninstall --save quickbase-api-react
# Optionally remove peerDependancies
npm uninstall --save quickbase
```

## Authentication Modes

- TEMPORARY TOKENS `mode`: `"production"`

- USER TOKEN `mode`: `"development"`

> **Note:** Consider setting `mode:` to enviornment variables associated with scripts like `npm run dev` or `npm run build`. So you can switch modes automatically.

Examples:

- **Vite** `mode`: `import.meta.env.MODE`
- **Webpack** `mode`: `process.env.NODE_ENV`
- **Create React App** `mode`: `process.env.NODE_ENV`

## Options

- **realm**: QuickBase realm (**required**).
- **userToken**: User token for development mode (**optional**).
- **appToken**: Depends on your app settings (**optional**).
- **mode**: `"development"` or `"production"` (default: `"production"`).
- **debug**: Enable detailed logging (default: `false`).
- **onError**: Callback for error handling (**optional**).

## Example

```typescript
import React, { useEffect, useState } from "react";
import { useQuickBase } from "quickbase-api-react";
import { QuickBaseResponseGetApp } from "quickbase";

const MyComponent: React.FC = () => {
  const qb = useQuickBase({
    realm: "your-realm", // required
    userToken: "user-token", // needed for mode: "development"
    appToken: "app-token", // optional
    mode: "development", // default is "production"
    debug: true, // default is false
    onError: (err, method, dbid) =>
      console.error(`Error in ${method} for ${dbid}: ${err.message}`), // Just an example
  });

  const [appData, setAppData] = useState<QuickBaseResponseGetApp | null>(null);

  useEffect(() => {
    const fetchApp = async () => {
      try {
        const response = await qb.getApp({ appId: "your-appId-here" });
        setAppData(response);
      } catch (error) {
        console.error("Fetch app failed:", error);
      }
    };
    fetchApp();
  }, [qb]);

  return <div>{appData ? appData.name : "Loading..."}</div>;
};

export default MyComponent;
```

## Contributing

If you would like to contribute to this project, please fork the repository and submit a pull request.

## License

This project is licensed under the MIT License.
