// @flow
import Sequelize from "sequelize";
import db from "../db";
import Server from "./server";
import User from "./user";

const Customer = db.define(
    "customer",
    {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        user_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: { model: User }
        },
        server_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: { model: Server }
        },
        created: { type: Sequelize.DATE, defaultValue: Sequelize.NOW }
    },
    {
        tableName: "customer",
        timestamps: false
    }
);

export default Customer;
