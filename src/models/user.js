// @flow
import Sequelize, { Op } from "sequelize";
import moment from "moment";
import db from "../db";
import Customer from "./customer";
import Server from "./server";
import type { SlackUser } from "../slack";

// TODO: first name
const User = db.define(
    "user",
    {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        slack_id: { type: Sequelize.STRING, allowNull: false, unique: true },
        username: { type: Sequelize.STRING, allowNull: false },
        email: { type: Sequelize.STRING, allowNull: false },
        real_name: Sequelize.STRING,
        tea_type: Sequelize.TEXT,
        deleted: { type: Sequelize.BOOLEAN, defaultValue: false },
        teas_brewed: { type: Sequelize.INTEGER, defaultValue: 0 },
        teas_drunk: { type: Sequelize.INTEGER, defaultValue: 0 },
        teas_received: { type: Sequelize.INTEGER, defaultValue: 0 },
        times_brewed: { type: Sequelize.INTEGER, defaultValue: 0 },
        nomination_points: { type: Sequelize.INTEGER, defaultValue: 0 },
        rank: { type: Sequelize.INTEGER },
        picture: Sequelize.STRING,
        name: {
            type: Sequelize.VIRTUAL,
            get() {
                return (this.real_name || this.username) + this.badge;
            }
        },
        badge: {
            type: Sequelize.VIRTUAL,
            get() {
                let badge = "";
                if (this.rank == 1) {
                    badge = ":first_place_medal:";
                } else if (this.rank == 2) {
                    badge = ":second_place_medal:";
                } else if (this.rank == 3) {
                    badge = ":third_place_medal:";
                }
                return badge;
            }
        },
        registered: {
            type: Sequelize.VIRTUAL,
            get() {
                return !!this.tea_type;
            }
        }
    },
    {
        tableName: "user",
        timestamps: false
    }
);

User.fromSlack = async (user: SlackUser) => {
    const [u, _] = await User.findOrCreate({
        where: { slack_id: user.id },
        defaults: {
            slack_id: user.id,
            username: user.name,
            email: user.profile.email,
            real_name: user.real_name,
            picture: user.profile.image_192
        }
    });
    return u;
};

// TODO: figure out if this can be done via ORM
User.getRanksSince = async date =>
    await db.query(
        `
            select user.*, count(server.id) + coalesce(sum(customer_count), 0) as total
            from server
            left join (
                select count(customer.id) as customer_count, server_id from customer group by server_id
            ) customer on customer.server_id = server.id
            join user on user.id = server.user_id
            where (user.deleted is null or user.deleted = 0)
              and server.created > "${date.format("YYYY-MM-DD HH:mm")}"
            group by server.user_id
            order by total desc
        `,
        { model: User }
    );

User.updateRanks = async () => {
    await User.update({ rank: 0 }, { where: {} });

    const date = moment().subtract({ months: 1 });
    const users = await User.getRanksSince(date);
    users.forEach((user, idx) => {
        user.rank = idx + 1;
        user.save();
    });
};

export default User;
