# Bot Authentication Sample
This contains the sample for bot authentication in Microsoft Teams.

## Getting started
Start by following the setup instructions in the [Microsoft Teams Sample (Node.JS)](https://github.com/OfficeDev/microsoft-teams-sample-complete-node), under [Steps to see the full app in Microsoft Teams](https://github.com/OfficeDev/microsoft-teams-sample-complete-node#steps-to-see-the-full-app-in-microsoft-teams), applying it to the code in this sample. The instructions in that project walk you through the following steps:
1. Set up a tunneling service such as [ngrok](https://ngrok.com/).
2. Register a bot in [Microsoft Bot Framework](https://dev.botframework.com/).
3. Configure the app so it runs as the registered bot.
4. Create an app manifest (follow the "Manual" instructions) and sideload the app into Microsoft Teams.

## Setup

The sample shows authentication against different identity providers. To be able to use an identity provider, first you will have to register your application with it.

### Changing app settings
This project uses the [config](https://www.npmjs.com/package/config) package. The default configuration is in `config\default.json`.
 - Environment variable overrides are defined in `config\custom-environment-variables.json`. You can set these environment variables when running node. If you are using Visual Studio Code, you can set these in your `launch.json` file.
 - Alternatively, you can specify local modifications in `config\local.json`.

The instructions below assume that you're using environment variables to configure the app, and will specify the name of the variable to set.

### Using AzureAD
Registering a bot with the Microsoft Bot Framework automatically creates a corresponding Azure AD application with the same name and ID. 
1. Go to the [Application Registration Portal](https://apps.dev.microsoft.com) and sign in with the same account that you used to register your bot.
2. Find your application in the list and click on the name to edit.
3. Click on "Add platform", choose "Web", then add the following redirect URL: `https://<your_ngrok_url>/auth/azureADv1/callback`.
4. Scroll to the bottom of the page and click on "Save".
5. The bot uses `MICROSOFT_APP_ID` and `MICROSOFT_APP_PASSWORD`, so these should already be set. No further changes needed!

### Using LinkedIn 
1. Follow the instructions in [Step 1 — Configuring your LinkedIn application](https://developer.linkedin.com/docs/oauth2) to create and configure a LinkedIn application for OAuth 2.
2. In "Authorized Redirect URLs", add `https://<your_ngrok_url>/auth/linkedIn/callback`.
3. Note your app's "Client ID" and "Client Secret".
4. Set `LINKEDIN_CLIENT_ID` = `<your_client_id>`, and `LINKEDIN_CLIENT_SECRET` = `<your_client_secret>`.
