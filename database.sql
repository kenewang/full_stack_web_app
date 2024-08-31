CREATE DATABASE share2teach;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE users(
    user_id uuid PRIMARY KEY DEFAULT
    uuid_generate_v4(),
    user_Fname VARCHAR(255) NOT NULL,
    user_Lname VARCHAR(255) NOT NULL,
    user_email VARCHAR(255) NOT NULL,
    userpassword VARCHAR(255) NOT NULL
);
INSERT INTO users (user_Fname,user_Lname,user_email,userpassword)
VALUES ('Otshepeng','Lethoba','otshepenglethoba63@gmail.com','808Mafia');