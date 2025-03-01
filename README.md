# quickbase-api-react

## Description

A React hook wrapper for [/tflanagan/node-quickbase](https://github.com/tflanagan/node-quickbase) providing token management, logging, and environment-specific behavior for the [QuickBase JSON RESTful API](https://developer.quickbase.com/). Written in TypeScript.

The aim of this project is to preserve and use [/tflanagan/node-quickbase](https://github.com/tflanagan/node-quickbase) in React. It retains access to the original method signatures for API requests. And uses the autoRenewTempTokens feature to regenerate temporary tokens after their 5 min lifespan expires.

## Pitch

- Stable: Handles temporary token mapping to dbids, logging, and API calls reliably.
- Efficient: Temporary token reuse, reducing API calls.
- Flexible: Supports all QuickBase methods without modification.
- Type-Safe: Retains original method signatures and response types.
- Logging: Offers configurable logging for debugging.
- Reusable: Can be dropped into any React project using [/tflanagan/node-quickbase](https://github.com/tflanagan/node-quickbase).

## Prerequisites

- React that supports hooks. Version `16.8` or higher.
- A QuickBase account. A free [builder account](https://www.quickbase.com/builder-program) will work.

## Install

```bash
npm install quickbase-api-react --save-dev
```

## Uninstall

```bash
npm uninstall quickbase-api-react --save-dev
```

## Authentication Modes

- TEMPORARY TOKENS `mode`: `"production"`

- USER TOKEN `mode`: `"development"`

> **Note:** Consider setting `mode:` to enviornment variables associated with scripts like `npm run dev` or `npm run build`. This will switch modes automatically.

Examples:

- **Vite** `mode`: `import.meta.env.MODE`
- **Webpack** `mode`: `process.env.NODE_ENV`
- **Create React App** `mode`: `process.env.NODE_ENV`

## Options

- **realm**: QuickBase realm (**required**).
- **userToken**: User token for development mode (**optional**).
- **appToken**: Depends on your app settings (**optional**).
- **mode**: `"development"` | `"production"` (default: `"production"`).
- **debug**: Enable detailed logging (default: `false`).
- **onError**: Callback for error handling (**optional**).

## Example

```typescript
import React, { useEffect, useState } from "react";
import { useQuickBase } from "@DrewBradfordXYZ/quickbase-react";
import { QuickBaseResponseGetApp } from "quickbase";

const MyComponent: React.FC = () => {
  const qb = useQuickBase({
    realm: "your-realm", // required
    userToken: "user-token", // needed for mode: "development"
    appToken: "app-token", // optional
    mode: "development", // default: "production"
    debug: true, // or false
    onError: (err, method, dbid) =>
      console.error(`Error in ${method} for ${dbid}: ${err.message}`),
  });

  const [appData, setAppData] = useState<QuickBaseResponseGetApp | null>(null);

  useEffect(() => {
    const fetchApp = async () => {
      try {
        const response = await qb.getApp({ appId: "xxxxxxx" });
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
