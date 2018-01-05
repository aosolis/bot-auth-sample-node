import * as builder from "botbuilder";
import * as msteams from "botbuilder-teams";
import * as winston from "winston";

const signinVerifyStateEventName = "signin/verifyState";

// =========================================================
// Auth Bot
// =========================================================

export class AuthBot extends builder.UniversalBot {

    constructor(
        public _connector: builder.IConnector,
        private botSettings: any,
        app: any,
    )
    {
        super(_connector, botSettings);
        this.set("persistConversationData", true);

        // Handle generic invokes
        let teamsConnector = this._connector as msteams.TeamsChatConnector;
        teamsConnector.onInvoke(async (event, cb) => {
            try {
                await this.onInvoke(event, cb);
            } catch (e) {
                winston.error("Invoke handler failed", e);
                cb(e, null, 500);
            }
        });

        // Register default dialog for testing
        this.dialog("/", async (session) => {
            session.endDialog("Hi!");
        });
    }

    // Handle other invokes
    private async onInvoke(event: builder.IEvent, cb: (err: Error, body: any, statusCode?: number) => void): Promise<void> {
        let invokeEvent = event as msteams.IInvokeEvent;
        let eventName = invokeEvent.name;

        switch (eventName) {
            case signinVerifyStateEventName:
                let state = JSON.parse(invokeEvent.value.state);
                let card = new builder.ThumbnailCard()
                    .text("You're signed in!");
                this.send(new builder.Message()
                    .address(event.address)
                    .text(state.text)
                    .addAttachment(card));
                cb(null, {}, 200);
                break;

            default:
                let unrecognizedEvent = `Unrecognized event name: ${eventName}`;
                winston.error(unrecognizedEvent);
                cb(new Error(unrecognizedEvent), null, 500);
                break;
        }
    }
}
