CREATE TABLE "companies" (
	"slug" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"country_iso3" char(3),
	"hq_city" text,
	"founded" smallint,
	"category" text,
	"valuation_usd" double precision,
	"total_funding_usd" double precision,
	"employees" integer,
	"summary" text,
	"website" text,
	"logo_path" text,
	"sources" jsonb
);
--> statement-breakpoint
CREATE TABLE "company_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_slug" text NOT NULL,
	"date" date NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"url" text
);
--> statement-breakpoint
CREATE TABLE "countries" (
	"iso3" char(3) PRIMARY KEY NOT NULL,
	"iso2" char(2) NOT NULL,
	"iso_numeric" char(3) NOT NULL,
	"name" text NOT NULL,
	"official_name" text NOT NULL,
	"region" text,
	"subregion" text,
	"lat" real NOT NULL,
	"lng" real NOT NULL
);
--> statement-breakpoint
CREATE TABLE "metric_defs" (
	"key" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"short_label" text NOT NULL,
	"description" text NOT NULL,
	"unit" text NOT NULL,
	"precision" smallint DEFAULT 0 NOT NULL,
	"higher_is_better" boolean DEFAULT true NOT NULL,
	"layer" text,
	"period_type" text NOT NULL,
	"source_id" text NOT NULL,
	"methodology_note" text
);
--> statement-breakpoint
CREATE TABLE "metrics" (
	"id" serial PRIMARY KEY NOT NULL,
	"country_iso3" char(3) NOT NULL,
	"metric_key" text NOT NULL,
	"period" text NOT NULL,
	"value" double precision NOT NULL,
	CONSTRAINT "metrics_unique" UNIQUE("country_iso3","metric_key","period")
);
--> statement-breakpoint
CREATE TABLE "models" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"organization" text,
	"country_iso3" char(3),
	"countries" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"publication_date" date,
	"domain" text,
	"parameters" double precision,
	"training_compute_flop" double precision,
	"link" text,
	"source_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rankings" (
	"metric_key" text NOT NULL,
	"period" text NOT NULL,
	"country_iso3" char(3) NOT NULL,
	"rank" integer NOT NULL,
	"prev_rank" integer,
	"delta" integer,
	"percentile" real NOT NULL,
	CONSTRAINT "rankings_metric_key_period_country_iso3_pk" PRIMARY KEY("metric_key","period","country_iso3")
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"license" text NOT NULL,
	"originator" text,
	"cadence" text,
	"notes" text,
	"retrieved_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_country_iso3_countries_iso3_fk" FOREIGN KEY ("country_iso3") REFERENCES "public"."countries"("iso3") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_events" ADD CONSTRAINT "company_events_company_slug_companies_slug_fk" FOREIGN KEY ("company_slug") REFERENCES "public"."companies"("slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metric_defs" ADD CONSTRAINT "metric_defs_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metrics" ADD CONSTRAINT "metrics_country_iso3_countries_iso3_fk" FOREIGN KEY ("country_iso3") REFERENCES "public"."countries"("iso3") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metrics" ADD CONSTRAINT "metrics_metric_key_metric_defs_key_fk" FOREIGN KEY ("metric_key") REFERENCES "public"."metric_defs"("key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "models" ADD CONSTRAINT "models_country_iso3_countries_iso3_fk" FOREIGN KEY ("country_iso3") REFERENCES "public"."countries"("iso3") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "models" ADD CONSTRAINT "models_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rankings" ADD CONSTRAINT "rankings_metric_key_metric_defs_key_fk" FOREIGN KEY ("metric_key") REFERENCES "public"."metric_defs"("key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rankings" ADD CONSTRAINT "rankings_country_iso3_countries_iso3_fk" FOREIGN KEY ("country_iso3") REFERENCES "public"."countries"("iso3") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "companies_country_idx" ON "companies" USING btree ("country_iso3");--> statement-breakpoint
CREATE INDEX "company_events_slug_idx" ON "company_events" USING btree ("company_slug","date");--> statement-breakpoint
CREATE INDEX "countries_numeric_idx" ON "countries" USING btree ("iso_numeric");--> statement-breakpoint
CREATE INDEX "metrics_lookup_idx" ON "metrics" USING btree ("metric_key","period");--> statement-breakpoint
CREATE INDEX "metrics_country_idx" ON "metrics" USING btree ("country_iso3");--> statement-breakpoint
CREATE INDEX "models_country_idx" ON "models" USING btree ("country_iso3");--> statement-breakpoint
CREATE INDEX "models_date_idx" ON "models" USING btree ("publication_date");--> statement-breakpoint
CREATE INDEX "rankings_lookup_idx" ON "rankings" USING btree ("metric_key","period","rank");