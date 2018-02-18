// @flow
import Sequelize from "sequelize";
import db from "../db";
import type { SlackUser } from "../slack";

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
        picture: Sequelize.STRING,
        name: {
            type: Sequelize.VIRTUAL,
            get: function() {
                return this.real_name || this.username;
            }
        },
        registered: {
            type: Sequelize.VIRTUAL,
            get: function() {
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

export default User;
