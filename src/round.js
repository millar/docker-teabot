// @flow
import config from "./conf";
import { Customer, Server, User } from "./models";
import type { SlackUser } from "./slack";

class Round {
    // How long (in seconds) until this round expires
    timeRemaining: ?number = null;

    // setInterval timer reference
    interval: ?IntervalID = null;

    server: User = null;
    customers: User[] = [];

    nomination: boolean = false;

    limit: ?number = null; // TODO: implement

    callback: Round => void;

    constructor(
        user: User,
        callback: Round => void,
        nomination: boolean = false
    ) {
        this.timeRemaining = config.brewTimeout;
        this.interval = setInterval(this.tick, 1000);
        this.server = user;
        this.callback = callback;
        this.nomination = nomination;
    }

    get active(): boolean {
        return this.timeRemaining !== null;
    }

    tick = (): void => {
        if (this.timeRemaining && this.timeRemaining > 0) {
            this.timeRemaining -= 1;
        }

        if (this.timeRemaining == 0 && this.interval) {
            clearInterval(this.interval);
            this.interval = null;
            this.timeRemaining = null;
            this.callback(this);
            this.recordRound();
        }
    };

    hasCustomer = (user: User) => this.customers.find(p => p.id == user.id);

    addCustomer = (user: User) => {
        this.customers.push(user);
    };

    recordRound = async () => {
        const updates = [];

        const server = await Server.create({
            user_id: this.server.id,
            limit: this.limit,
            completed: true
        });

        this.customers.forEach(customer => {
            updates.push(
                customer.increment({
                    teas_drunk: 1,
                    teas_received: 1
                }),
                Customer.create({
                    user_id: customer.id,
                    server_id: server.id
                })
            );
        });

        updates.push(
            this.server.increment({
                teas_brewed: this.customers.length + 1,
                teas_drunk: 1,
                times_brewed: 1
            })
        );

        await Promise.all(updates);

        // Update ranks only after all customer records have been persisted
        User.updateRanks();
    };
}

export default Round;
