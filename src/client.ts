
import { connect, NatsConnection, StringCodec, Subscription } from 'nats';

class NatsClient {
    private nc!: NatsConnection;
    private sc = StringCodec();
    private clientId: string;

    constructor(clientId: string) {
        this.clientId = clientId;
    }

    async connect() {
        try {
            console.log(`Client ${this.clientId}: Connecting to NATS...`);
            
            this.nc = await connect({
                servers: 'nats://localhost:4222',
                timeout: 3000,
                reconnect: true,
                maxReconnectAttempts: 10,
                name: this.clientId
            });

            console.log(`Client ${this.clientId}: Connected to NATS at ${this.nc.getServer()}`);
            
            //connection monitorin
            this.setupConnectionMonitoring();
            
            return true;
        } catch (err) {
            console.error(`Client ${this.clientId}: Connection failed:`, err);
            throw err;
        }
    }

    private setupConnectionMonitoring() {
        // Monitor connection status
        (async () => {
            for await (const status of this.nc.status()) {
                console.log(`Client ${this.clientId}: Connection status:`, status.type);
            }
        })().catch((err) => {
            console.error(`Client ${this.clientId}: Status monitoring error:`, err);
        });

        // Handle connection closure
        this.nc.closed().then((err) => {
            if (err) {
                console.error(`Client ${this.clientId}: Connection closed with error:`, err);
            } else {
                console.log(`Client ${this.clientId}: Connection closed gracefully`);
            }
        });
    }

    async publish(subject: string, message: string) {
        try {
            console.log(`Client ${this.clientId}: Publishing to ${subject}:`, message);
            this.nc.publish(subject, this.sc.encode(message));
        } catch (err) {
            console.error(`Client ${this.clientId}: Publish failed:`, err);
            throw err;
        }
    }

    async request(subject: string, message: string, timeout = 5000): Promise<string> {
        try {
            console.log(`Client ${this.clientId}: Sending request to ${subject}:`, message);
            const response = await this.nc.request(subject, this.sc.encode(message), { timeout });
            const responseData = this.sc.decode(response.data);
            console.log(`Client ${this.clientId}: Received response:`, responseData);
            return responseData;
        } catch (err) {
            console.error(`Client ${this.clientId}: Request failed:`, err);
            throw err;
        }
    }

    async subscribe(subject: string) {
        try {
            console.log(`Client ${this.clientId}: Subscribing to ${subject}`);
            const sub: Subscription = this.nc.subscribe(subject);

            // Handle messages
            (async () => {
                for await (const msg of sub) {
                    const data = this.sc.decode(msg.data);
                    console.log(`Client ${this.clientId}: Received message on ${subject}:`, data);
                }
            })().catch((err) => {
                console.error(`Client ${this.clientId}: Subscription error:`, err);
            });

            return sub;
        } catch (err) {
            console.error(`Client ${this.clientId}: Subscribe failed:`, err);
            throw err;
        }
    }

    async close() {
        try {
            console.log(`Client ${this.clientId}: Closing connection...`);
            await this.nc.drain();
            await this.nc.close();
            console.log(`Client ${this.clientId}: Connection closed`);
        } catch (err) {
            console.error(`Client ${this.clientId}: Close failed:`, err);
            throw err;
        }
    }

    async subscribeToDirectMessages(): Promise<Subscription> {
        const directSubject = `direct.${this.clientId}`;
        try {
            console.log(`Client ${this.clientId}: Subscribing to direct messages on ${directSubject}`);
            const sub = this.nc.subscribe(directSubject);

            // Handle direct messages
            (async () => {
                for await (const msg of sub) {
                    const data = this.sc.decode(msg.data);
                    const sender = msg.headers?.get('sender') || 'unknown';
                    console.log(`Client ${this.clientId}: Received direct message from ${sender}:`, data);
                    
                    // Auto-reply with acknowledgment if reply subject is provided
                    if (msg.reply) {
                        this.nc.publish(msg.reply, this.sc.encode(`Message received by ${this.clientId}`));
                    }
                }
            })().catch((err) => {
                console.error(`Client ${this.clientId}: Direct message subscription error:`, err);
            });

            return sub;
        } catch (err) {
            console.error(`Client ${this.clientId}: Direct message subscribe failed:`, err);
            throw err;
        }
    }

    async sendDirectMessage(targetClientId: string, message: string): Promise<string | void> {
        const directSubject = `direct.${targetClientId}`;
        try {
            console.log(`Client ${this.clientId}: Sending direct message to ${targetClientId}:`, message);
            
            

            const response = await this.nc.request(directSubject, this.sc.encode(message), {
                timeout: 5000,
            
            });
            
            const responseData = this.sc.decode(response.data);
            console.log(`Client ${this.clientId}: Received confirmation:`, responseData);
            return responseData;
        } catch (err) {
            console.error(`Client ${this.clientId}: Direct message send failed:`, err);
            throw err;
        }
    }
}
// async function runExample() {
//     // Create two clients
//     const publisher = new NatsClient('Publisher');
//     const subscriber = new NatsClient('Subscriber');

//     try {
//         // Connect both clients
//         await publisher.connect();
//         await subscriber.connect();

//         // Setup subscription
//         await subscriber.subscribe('messages.test');

//         // Publish messages
//         await publisher.publish('messages.test', 'Hello NATS!');

//         // Try request-reply
//         try {
//             const response = await publisher.request('user.get', 'user123');
//             console.log('Request-reply response:', response);
//         } catch (err) {
//             console.error('Request-reply failed:', err);
//         }

//         // Wait a bit before closing
//         await new Promise(resolve => setTimeout(resolve, 1000));

//         // Cleanup
//         await publisher.close();
//         await subscriber.close();
        
//     } catch (err) {
//         console.error('Example run failed:', err);
//     }
// }

// // Run the example if this file is run directly
// if (require.main === module) {
//     runExample().catch(console.error);
// }

// export default NatsClient;


async function runDirectMessageExample() {
    const client1 = new NatsClient('client1');
    const client2 = new NatsClient('client2');

    try {
        await client1.connect();
        await client2.connect();

        await client1.subscribeToDirectMessages();
        await client2.subscribeToDirectMessages();

        await client1.sendDirectMessage('client2', 'Hello client2!');
        await client2.sendDirectMessage('client1', 'Hello back client1!');

        await new Promise(resolve => setTimeout(resolve, 1000));

        // Cleanup
        await client1.close();
        await client2.close();
        
    } catch (err) {
        console.error('Direct messaging example failed:', err);
    }
}
runDirectMessageExample()
export default NatsClient;
