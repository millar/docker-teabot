// @flow
import config from "./conf";
import User from "./models/user";
import type { SlackUser } from "./slack";

class Round {
    // How long (in seconds) until this round expires
    timeRemaining: ?number = null;

    // setInterval timer reference
    interval: ?IntervalID = null;

    server: User = null;
    customers: [User] = [];

    callback: () => void;

    constructor(user: User, callback: () => void) {
        this.timeRemaining = config.brewTimeout;
        this.interval = setInterval(this.tick, 1000);
        this.server = user;
        this.callback = callback;
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

    hascustomer = user => this.customers.find(p => p.id == user.id);

    addcustomer = user => {
        this.customers.push(user);
    };

    recordRound = () => {
        this.customers.forEach(customer => {
            customer.teas_drunk += 1;
            customer.teas_received += 1;
            this.server.teas_brewed += 1;
        });

        this.server.teas_brewed += 1;
        this.server.teas_drunk += 1;
        this.server.times_brewed += 1;

        this.customers.forEach(customer => customer.save());
        this.server.save();
    };
}

export default Round;
