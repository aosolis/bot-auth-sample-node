import * as builder from "botbuilder";
import * as msteams from "botbuilder-teams";
import * as winston from "winston";

// =========================================================
// Bot Setup
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
            let card = new builder.ThumbnailCard(session)
                .text("Hi, I'm Tay's more impressionable sibling, Yat!")
                .buttons([
                    new builder.CardAction()
                        .type("signin")
                        .title("Tell me what to say")
                        .value("https://97e6e8c9.ngrok.io/html/tellme.html?width=400&height=400"),
                ]);
            session.endDialog(new builder.Message(session).addAttachment(card));
        });
    }

    // Handle other invokes
    private async onInvoke(event: builder.IEvent, cb: (err: Error, body: any, statusCode?: number) => void): Promise<void> {
        let invokeEvent = event as msteams.IInvokeEvent;
        let eventName = invokeEvent.name;

        switch (eventName) {
            case "signin/verifyState":
                let state = JSON.parse(invokeEvent.value.state);
                let card = new builder.ThumbnailCard()
                .text("Hi, I'm Tay's more impressionable sibling, Yat!")
                .buttons([
                    new builder.CardAction()
                        .type("signin")
                        .title("Tell me what to say")
                        .value("https://97e6e8c9.ngrok.io/html/tellme.html?width=400&height=400"),
                ]);
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
