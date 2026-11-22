import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  Modal, FlatList, useColorScheme,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { D } from "./taxData";

export default function App() {
  const dark = useColorScheme() === "dark";
  const c = dark
    ? { bg: "#161615", card: "#222221", tx: "#efefea", mut: "#9a9a94", ac: "#5dcaa5", bd: "#363634", on: "#161615" }
    : { bg: "#f7f7f4", card: "#ffffff", tx: "#1d1d1b", mut: "#6b6b66", ac: "#0f6e56", bd: "#e2e2dc", on: "#ffffff" };

  const [key, setKey] = useState("US");
  const [full, setFull] = useState(false);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [inc, setInc] = useState("60000");
  const [pr, setPr] = useState("100");
  const [bp, setBp] = useState("100000");
  const [gn, setGn] = useState("10000");

  const n = (s) => parseFloat(String(s).replace(/,/g, "")) || 0;
  const d = D[key];
  const cur = d[1];
  const f = (v) => {
    try {
      return new Intl.NumberFormat("en", { style: "currency", currency: cur, maximumFractionDigits: 0 }).format(v);
    } catch (e) {
      return Math.round(v) + " " + cur;
    }
  };

  const income = n(inc);
  let tax = 0, lo = 0;
  d[2].forEach((b) => {
    if (income > lo) tax += ((Math.min(income, b[0]) - lo) * b[1]) / 100;
    lo = b[0];
  });
  const soc = (income * d[6]) / 100;
  const price = n(pr);
  const filtered = Object.keys(D).filter((k) => D[k][0].toLowerCase().includes(q.toLowerCase().trim()));

  const Row = ({ label, value }) => (
    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: c.bd }}>
      <Text style={{ color: c.tx, fontSize: 15, flex: 1 }}>{label}</Text>
      <Text style={{ color: c.tx, fontSize: 15, fontWeight: "600" }}>{value}</Text>
    </View>
  );
  const Card = ({ title, children }) => (
    <View style={{ backgroundColor: c.card, borderColor: c.bd, borderWidth: 1, borderRadius: 14, padding: 14, marginTop: 14 }}>
      <Text style={{ color: c.mut, fontSize: 13, marginBottom: 4 }}>{title}</Text>
      {children}
    </View>
  );
  const Field = ({ label, value, onChange }) => (
    <View>
      <Text style={{ color: c.mut, fontSize: 13, marginTop: 12, marginBottom: 4 }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType="numeric"
        style={{ backgroundColor: c.card, color: c.tx, borderColor: c.bd, borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 16 }}
      />
    </View>
  );
  const Tab = ({ label, on, onPress }) => (
    <TouchableOpacity
      onPress={onPress}
      style={{ flex: 1, padding: 12, borderRadius: 10, alignItems: "center", borderWidth: 1, borderColor: on ? c.ac : c.bd, backgroundColor: on ? c.ac : c.card }}
    >
      <Text style={{ color: on ? c.on : c.tx, fontSize: 15, fontWeight: "600" }}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: 48 }}>
      <StatusBar style={dark ? "light" : "dark"} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <Text style={{ color: c.tx, fontSize: 26, fontWeight: "700" }}>TaxLens</Text>
        <Text style={{ color: c.mut, marginBottom: 14 }}>Rough tax estimates for 30 countries</Text>

        <View style={{ flexDirection: "row", gap: 8 }}>
          <Tab label="Quick" on={!full} onPress={() => setFull(false)} />
          <Tab label="Full" on={full} onPress={() => setFull(true)} />
        </View>

        <Text style={{ color: c.mut, fontSize: 13, marginTop: 12, marginBottom: 4 }}>Country</Text>
        <TouchableOpacity
          onPress={() => setOpen(true)}
          style={{ backgroundColor: c.card, borderColor: c.bd, borderWidth: 1, borderRadius: 10, padding: 12 }}
        >
          <Text style={{ color: c.tx, fontSize: 16 }}>{d[0]} ({cur})  ▾</Text>
        </TouchableOpacity>

        <Field label="Yearly gross income" value={inc} onChange={setInc} />
        {full && <Field label="Purchase price (before VAT/sales tax)" value={pr} onChange={setPr} />}
        {full && <Field label="Business profit" value={bp} onChange={setBp} />}
        {full && <Field label="Investment gain" value={gn} onChange={setGn} />}

        <Card title="Take-home pay">
          <Text style={{ color: c.ac, fontSize: 28, fontWeight: "700", marginBottom: 4 }}>{f(income - tax - soc)}</Text>
          <Row label="Income tax" value={f(tax)} />
          <Row label="Social contributions" value={f(soc)} />
          <Row label="Effective total rate" value={income ? (((tax + soc) / income) * 100).toFixed(1) + "%" : "0%"} />
        </Card>

        {full && (
          <Card title="Other taxes">
            <Row label={"VAT / sales tax (" + d[3] + "%)"} value={f((price * d[3]) / 100)} />
            <Row label="Price with tax" value={f(price * (1 + d[3] / 100))} />
            <Row label={"Corporate tax (" + d[4] + "%)"} value={f((Math.max(n(bp), 0) * d[4]) / 100)} />
            <Row label={"Capital gains tax (" + d[5] + "%)"} value={f((Math.max(n(gn), 0) * d[5]) / 100)} />
          </Card>
        )}

        <Text style={{ color: c.mut, fontSize: 12, marginTop: 16 }}>
          Simplified: single filer, no deductions or credits, headline rates (about 2025). Regional, local and property taxes are not included. This is not tax advice. Check official sources before making decisions.
        </Text>
      </ScrollView>

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: 48, padding: 16 }}>
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Search country…"
            placeholderTextColor={c.mut}
            autoFocus
            style={{ backgroundColor: c.card, color: c.tx, borderColor: c.bd, borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 16, marginTop: 16 }}
          />
          <FlatList
            data={filtered}
            keyExtractor={(k) => k}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => { setKey(item); setQ(""); setOpen(false); }}
                style={{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: c.bd }}
              >
                <Text style={{ color: c.tx, fontSize: 16 }}>{D[item][0]}</Text>
              </TouchableOpacity>
            )}
          />
          <TouchableOpacity onPress={() => setOpen(false)} style={{ padding: 14, alignItems: "center" }}>
            <Text style={{ color: c.ac, fontSize: 16, fontWeight: "600" }}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
                                         }
