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

Customer.belongsTo(User, { foreignKey: "user_id" });
Customer.belongsTo(Server, { foreignKey: "server_id" });
Server.hasMany(Customer, { foreignKey: "server_id" });

export default Customer;
