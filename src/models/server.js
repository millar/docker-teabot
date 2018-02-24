// @flow
import Sequelize from "sequelize";
import db from "../db";
import User from "./user";

const Server = db.define(
    "server",
    {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        user_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: { model: User }
        },
        completed: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: true
        },
        created: { type: Sequelize.DATE, defaultValue: Sequelize.NOW },
        limit: Sequelize.INTEGER
    },
    {
        tableName: "server",
        timestamps: false
    }
);

Server.belongsTo(User, { foreignKey: "user_id" });

export default Server;
