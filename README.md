# quickbase-api-react

## Description

A React Hook wrapper for the QuickBase RESTful API [/tflanagan/node-quickbase](https://github.com/tflanagan/node-quickbase) providing token management, logging, and environment-specific behavior.

Written in Typescript, for development and production environments.

## Pitch

- Stable: Handles dbid temp-token reuse and renewal, logging, and API calls reliably.
- Flexible: Supports all QuickBase methods without modification.
- Type-Safe: Retains original method signatures and response types.
- Logging: Offers configurable logging for debugging.
- Reusable: Can be dropped into any React project using https://github.com/tflanagan/node-quickbase

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

## Authentication

`npm run build` uses `temporary tokens`

`npm run dev` uses a `user token`

## Options

- **realm**: QuickBase realm (**required**).
- **userToken**: User token for development mode (**optional**).
- **appToken**: App token for production mode (**optional**).
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
    userToken: "user-token",
    appToken: "app-token",
    realm: "your-realm",
    mode: "development",
    debug: true,
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
