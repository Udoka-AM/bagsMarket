-- NOTE: drizzle-kit generated `CREATE SCHEMA "auth"` and `CREATE TABLE
-- "auth"."users"` here. Both were removed by hand: Supabase owns that schema and
-- creates it before any of our migrations run, so re-creating it fails.
-- src/schema/_shared.ts declares auth.users only so foreign keys can reference
-- it. The snapshot in meta/ still records it as present, which is what keeps
-- later `drizzle-kit generate` runs from re-emitting this DDL.
CREATE TYPE "public"."claim_status" AS ENUM('pending', 'confirmed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."launch_status" AS ENUM('draft', 'pending', 'live', 'failed', 'closed');--> statement-breakpoint
CREATE TYPE "public"."alert_channel" AS ENUM('in_app', 'email', 'webhook');--> statement-breakpoint
CREATE TYPE "public"."alert_subject" AS ENUM('launch', 'token', 'wallet', 'repository');--> statement-breakpoint
CREATE TYPE "public"."delivery_status" AS ENUM('pending', 'delivered', 'failed');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('queued', 'running', 'succeeded', 'failed', 'dead');--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"handle" text,
	"display_name" text,
	"avatar_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_handle_unique" UNIQUE("handle")
);
--> statement-breakpoint
CREATE TABLE "wallets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"address" text NOT NULL,
	"label" text,
	"is_primary" boolean DEFAULT false NOT NULL,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wallets_profile_address_key" UNIQUE("profile_id","address")
);
--> statement-breakpoint
CREATE TABLE "claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"launch_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"amount" numeric(40, 0) NOT NULL,
	"token_mint" text NOT NULL,
	"tx_signature" text,
	"status" "claim_status" DEFAULT 'pending' NOT NULL,
	"confirmed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "claims_tx_signature_key" UNIQUE("tx_signature")
);
--> statement-breakpoint
CREATE TABLE "fee_shares" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"launch_id" uuid NOT NULL,
	"recipient_address" text NOT NULL,
	"basis_points" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fee_shares_launch_recipient_key" UNIQUE("launch_id","recipient_address"),
	CONSTRAINT "fee_shares_basis_points_range" CHECK ("fee_shares"."basis_points" between 0 and 10000)
);
--> statement-breakpoint
CREATE TABLE "launches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"bags_launch_id" text,
	"token_mint" text,
	"name" text NOT NULL,
	"symbol" text,
	"status" "launch_status" DEFAULT 'draft' NOT NULL,
	"launched_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "launches_bags_id_key" UNIQUE("bags_launch_id")
);
--> statement-breakpoint
CREATE TABLE "alert_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"alert_id" uuid NOT NULL,
	"fired_at" timestamp with time zone DEFAULT now() NOT NULL,
	"payload" jsonb NOT NULL,
	"delivery_status" "delivery_status" DEFAULT 'pending' NOT NULL,
	"delivered_at" timestamp with time zone,
	"explanation" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"name" text NOT NULL,
	"subject_type" "alert_subject" NOT NULL,
	"subject_ref" text NOT NULL,
	"rule" jsonb NOT NULL,
	"channel" "alert_channel" DEFAULT 'in_app' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"muted_until" timestamp with time zone,
	"last_fired_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "activity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"subject_type" text,
	"subject_ref" text,
	"metadata" jsonb,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid,
	"kind" text NOT NULL,
	"status" "job_status" DEFAULT 'queued' NOT NULL,
	"payload" jsonb,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"last_error" text,
	"scheduled_for" timestamp with time zone,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_id_users_id_fk" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claims" ADD CONSTRAINT "claims_launch_id_launches_id_fk" FOREIGN KEY ("launch_id") REFERENCES "public"."launches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claims" ADD CONSTRAINT "claims_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_shares" ADD CONSTRAINT "fee_shares_launch_id_launches_id_fk" FOREIGN KEY ("launch_id") REFERENCES "public"."launches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "launches" ADD CONSTRAINT "launches_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_events" ADD CONSTRAINT "alert_events_alert_id_alerts_id_fk" FOREIGN KEY ("alert_id") REFERENCES "public"."alerts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "wallets_address_idx" ON "wallets" USING btree ("address");--> statement-breakpoint
CREATE INDEX "claims_launch_idx" ON "claims" USING btree ("launch_id");--> statement-breakpoint
CREATE INDEX "claims_profile_idx" ON "claims" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "launches_profile_idx" ON "launches" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "launches_token_mint_idx" ON "launches" USING btree ("token_mint");--> statement-breakpoint
CREATE INDEX "alert_events_alert_fired_idx" ON "alert_events" USING btree ("alert_id","fired_at");--> statement-breakpoint
CREATE INDEX "alerts_profile_idx" ON "alerts" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "alerts_active_subject_idx" ON "alerts" USING btree ("is_active","subject_type","subject_ref");--> statement-breakpoint
CREATE INDEX "activity_profile_occurred_idx" ON "activity" USING btree ("profile_id","occurred_at");--> statement-breakpoint
CREATE INDEX "jobs_status_kind_scheduled_idx" ON "jobs" USING btree ("status","kind","scheduled_for");--> statement-breakpoint
CREATE INDEX "jobs_profile_idx" ON "jobs" USING btree ("profile_id");