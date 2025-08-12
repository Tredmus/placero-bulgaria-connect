import React, { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

// shadcn/ui
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { ChevronsUpDown, Check, Loader2 } from "lucide-react";

/**
 * DATA MODEL (Supabase)
 * tables:
 *  - provinces(id uuid|int, name text)
 *  - cities(id uuid|int, name text, province_id -> provinces.id)
 *  - streets(id uuid|int, name text, city_id -> cities.id)
 *
 * All queries below use these tables. If your schema differs, adjust the column names.
 */

const schema = z.object({
  provinceId: z.string().min(1, "Избери област"),
  cityId: z.string().min(1, "Избери град/село"),
  streetId: z.string().min(1, "Избери улица"),
  addressDetails: z
    .string()
    .max(120, "Макс. 120 символа")
    .optional()
    .or(z.literal("")),
});

export type LocationFormValues = z.infer<typeof schema>;

// Generic searchable combobox, wired for async datasets
function SearchCombo({
  value,
  onChange,
  placeholder,
  disabled,
  loading,
  options,
  labelKey = "label",
  className,
  error,
}: {
  value?: string;
  onChange: (val: string) => void;
  placeholder: string;
  disabled?: boolean;
  loading?: boolean;
  options: { value: string; label: string }[];
  labelKey?: string;
  className?: string;
  error?: boolean;
}) {
  const [open, setOpen] = useState(false);

  const selected = useMemo(() => options.find((o) => o.value === value)?.label, [options, value]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between",
            disabled && "opacity-60 cursor-not-allowed",
            error && "border-red-500 focus-visible:ring-red-500",
            className
          )}
          disabled={disabled}
        >
          <span className={cn(!selected && "text-muted-foreground")}>{selected || placeholder}</span>
          {loading ? (
            <Loader2 className="ml-2 h-4 w-4 animate-spin" />
          ) : (
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />)
          }
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
        <Command>
          <CommandInput placeholder={placeholder} />
          <CommandEmpty>Няма резултати</CommandEmpty>
          <CommandGroup>
            {options.map((opt) => (
              <CommandItem
                key={opt.value}
                value={opt.label}
                onSelect={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
              >
                <Check className={cn("mr-2 h-4 w-4", value === opt.value ? "opacity-100" : "opacity-0")} />
                {opt.label}
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default function LocationFormCascading({
  defaultValues,
  onSubmit,
  className,
}: {
  defaultValues?: Partial<LocationFormValues>;
  onSubmit: (values: LocationFormValues) => void | Promise<void>;
  className?: string;
}) {
  const form = useForm<LocationFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      provinceId: "",
      cityId: "",
      streetId: "",
      addressDetails: "",
      ...defaultValues,
    },
    mode: "onSubmit",
  });

  const provinceId = form.watch("provinceId");
  const cityId = form.watch("cityId");

  const [provOptions, setProvOptions] = useState<{ value: string; label: string }[]>([]);
  const [cityOptions, setCityOptions] = useState<{ value: string; label: string }[]>([]);
  const [streetOptions, setStreetOptions] = useState<{ value: string; label: string }[]>([]);

  const [loadingProv, setLoadingProv] = useState(false);
  const [loadingCity, setLoadingCity] = useState(false);
  const [loadingStreet, setLoadingStreet] = useState(false);

  // Load provinces once
  useEffect(() => {
    let active = true;
    (async () => {
      setLoadingProv(true);
      const { data, error } = await supabase
        .from("provinces")
        .select("id, name")
        .order("name", { ascending: true });
      if (active) {
        if (!error && data) {
          setProvOptions(data.map((r: any) => ({ value: String(r.id), label: r.name })));
        }
        setLoadingProv(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // When province changes, reset and load cities
  useEffect(() => {
    let active = true;
    form.setValue("cityId", "");
    form.setValue("streetId", "");
    setCityOptions([]);
    setStreetOptions([]);

    if (!provinceId) return;
    (async () => {
      setLoadingCity(true);
      const { data, error } = await supabase
        .from("cities")
        .select("id, name")
        .eq("province_id", provinceId)
        .order("name", { ascending: true });
      if (active) {
        if (!error && data) {
          setCityOptions(data.map((r: any) => ({ value: String(r.id), label: r.name })));
        }
        setLoadingCity(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [provinceId]);

  // When city changes, reset and load streets (lazy first page)
  useEffect(() => {
    let active = true;
    form.setValue("streetId", "");
    setStreetOptions([]);

    if (!cityId) return;
    (async () => {
      setLoadingStreet(true);
      // initial list (can be big). If your streets table is huge, you can server-side page or require typing (see below).
      const { data, error } = await supabase
        .from("streets")
        .select("id, name")
        .eq("city_id", cityId)
        .order("name", { ascending: true })
        .limit(1000);
      if (active) {
        if (!error && data) {
          setStreetOptions(data.map((r: any) => ({ value: String(r.id), label: r.name })));
        }
        setLoadingStreet(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [cityId]);

  // OPTIONAL: type-to-filter streets client-side via CommandInput built-in filtering.
  // If you need server-side filtering for massive datasets, wire CommandInput's value to a state and query supabase with ilike("name", `%term%`).

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(async (vals) => onSubmit(vals))}
        className={cn("grid gap-6", className)}
      >
        {/* Province */}
        <FormField
          control={form.control}
          name="provinceId"
          render={({ field, fieldState }) => (
            <FormItem>
              <FormLabel>Област</FormLabel>
              <FormControl>
                <SearchCombo
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Избери област..."
                  disabled={false}
                  loading={loadingProv}
                  options={provOptions}
                  error={!!fieldState.error}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* City */}
        <FormField
          control={form.control}
          name="cityId"
          render={({ field, fieldState }) => (
            <FormItem>
              <FormLabel>Населено място</FormLabel>
              <FormControl>
                <SearchCombo
                  value={field.value}
                  onChange={field.onChange}
                  placeholder={provinceId ? "Избери град/село..." : "Първо избери област"}
                  disabled={!provinceId}
                  loading={loadingCity}
                  options={cityOptions}
                  error={!!fieldState.error}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Street */}
        <FormField
          control={form.control}
          name="streetId"
          render={({ field, fieldState }) => (
            <FormItem>
              <FormLabel>Улица</FormLabel>
              <FormControl>
                <SearchCombo
                  value={field.value}
                  onChange={field.onChange}
                  placeholder={cityId ? "Избери улица..." : "Първо избери населено място"}
                  disabled={!cityId}
                  loading={loadingStreet}
                  options={streetOptions}
                  error={!!fieldState.error}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Extra address details (optional) */}
        <FormField
          control={form.control}
          name="addressDetails"
          render={({ field, fieldState }) => (
            <FormItem>
              <FormLabel>Допълнително (бл., вх., ап., етаж...)</FormLabel>
              <FormControl>
                <input
                  type="text"
                  placeholder="По желание"
                  className={cn(
                    "w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    fieldState.error && "border-red-500 focus-visible:ring-red-500"
                  )}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex items-center gap-3">
          <Button type="submit" className="min-w-[140px]">Запази локация</Button>
        </div>
      </form>
    </Form>
  );
}
