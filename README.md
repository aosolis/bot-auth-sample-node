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
4. Set the environment variables (or equivalent config) `LINKEDIN_CLIENT_ID` = `<your_client_id>`, and `LINKEDIN_CLIENT_SECRET` = `<your_client_secret>`.

### Using Google 
1. Obtain OAuth2 client credentials from the [Google API Console](https://console.developers.google.com). Enable access to the [Google People API](https://developers.google.com/people/). 
2. In "Authorized redirect URLs", add `https://<your_ngrok_url>/auth/google/callback`.
3. Note your app's "Client ID" and "Client Secret".
4. Set the environment variables (or equivalent config) `GOOGLE_CLIENT_ID` = `<your_client_id>`, and `GOOGLE_CLIENT_SECRET` = `<your_client_secret>`.


## Bot authentication flow

![Bot auth sequence diagram](https://aosolis.github.io/bot-auth/bot_auth_sequence.png)

1. The user sends a message to the bot.
2. The bot determines if the user needs to sign in.
    * In the example, the bot stores the access token in its user data store, and uses the presence of a validated token to determine if the user needs to log in. ([View code](https://github.com/aosolis/bot-auth-sample-node/blob/a1ed3b2e275afd2afb2de28a93f9db9651d9b5f7/src/dialogs/BaseIdentityDialog.ts#L168))
3. The bot constructs the URL to the auth start page, and sends a card to the user with a "signin" action. Like other Microsoft Teams app auth flows, the start page must be on a domain that's the `validDomains` list, and on the same domain as the OAuth redirect page. ([View code](https://github.com/aosolis/bot-auth-sample-node/blob/a1ed3b2e275afd2afb2de28a93f9db9651d9b5f7/src/dialogs/BaseIdentityDialog.ts#L173-L191))
    * **IMPORTANT**: The `state` parameter of the signin URL must contain a unique session token to prevent request forgery attacks. The example uses a randomly-generated UUID.
4. When the user clicks on the button, Teams opens a popup window and navigates it to the start page.
5. The start page redirects the user to the identity provider's `authorize` endpoint. ([View code](https://github.com/aosolis/bot-auth-sample-node/blob/a1ed3b2e275afd2afb2de28a93f9db9651d9b5f7/public/html/auth-start.html#L51-L56))
6. On the identity provider's page, the user signs in an grants access to the bot.
7. The identity provider takes the user to the bot's OAuth redirect page, with an authorization code.
8. Bot redeems the authorization code for an access token, and provisionally associates the token with the user that initiated the signin flow.
    * In the example, the bot uses information in the OAuth `state` parameter to determine the user that started the signin process. Before proceeding, it checks the value against the expected `state` value, to detect forged requests. ([View code](https://github.com/aosolis/bot-auth-sample-node/blob/a1ed3b2e275afd2afb2de28a93f9db9651d9b5f7/src/AuthBot.ts#L62-L91))
    * **IMPORTANT**: The provisional token is stored in the user data store, but it is marked as "pending validation". The user has to "complete the loop" by sending the verification code in Teams, to ensure that the user who authorized the bot with the identity provider is the same user who is chatting with the bot in Teams. Until then, the token should not be used. ([View code](https://github.com/aosolis/bot-auth-sample-node/blob/a1ed3b2e275afd2afb2de28a93f9db9651d9b5f7/src/AuthBot.ts#L91-L105))
9. OAuth callback renders a page that calls `notifySuccess("<verification code>")`. ([View code](https://github.com/aosolis/bot-auth-sample-node/blob/master/src/views/oauth-callback-success.hbs))
10. Teams closes the popup and sends the string passed to `notifySuccess()` over to the bot via an invoke message with `name` = ` signin/verifyState`.
11. Bot checks the incoming verification code against the code stored in the user's provisional token. ([View code](https://github.com/aosolis/bot-auth-sample-node/blob/a1ed3b2e275afd2afb2de28a93f9db9651d9b5f7/src/dialogs/BaseIdentityDialog.ts#L140-L153))
12. If they match, bot marks the token as validated and ready for use. Otherwise, the auth flow fails, and it deletes the provisional token.

## Mobile devices
As of February 2018, the Microsoft Teams mobile clients do not fully support the `signin` action protocol.
* If the URL provided to the `signin` action has a `fallbackUrl` query string parameter, Teams will launch that URL in the browser.
* Otherwise, Teams will show an error saying that the action is not yet supported on mobile.

In the example, the mobile signin flow is the same as on desktop, until the point where the OAuth callback tries to send the verification back to the bot via `notifySuccess()`. Therefore the bot sets the `fallbackUrl` parameter to be the same as the original url to the auth start page. ([View code](https://github.com/aosolis/bot-auth-sample-node/blob/c440f4936a707bc0690480cfc84cb5f5eb9d2675/src/dialogs/BaseIdentityDialog.ts#L186-L191))

When the auth flow runs in a mobile browser, the call to `notifySuccess()` will fail and the window will not close. If the page hasn't closed after 5 seconds, it asks the user to manually send the verification code in the Teams chat. The bot handles receiving the verification code from either the `signin/verifyState` callback or a chat message. ([View code](https://github.com/aosolis/bot-auth-sample-node/blob/c440f4936a707bc0690480cfc84cb5f5eb9d2675/src/dialogs/BaseIdentityDialog.ts#L119-L130))

If you want to limit signing in to non-mobile clients only, you can choose to omit the `fallbackUrl` parameter, or point it to an error page asking the user to sign  in on web or desktop.

When the Microsoft Teams mobile clients support the complete signin protocol, including passing the verification code via `notifySuccess()`, they will launch the auth start page in a popup window and ignore `fallbackUrl`.