create table users (
  id text primary key,
  email text not null
);

create table subscriptions (
  id text primary key,
  user_id text not null,
  status text not null
);
