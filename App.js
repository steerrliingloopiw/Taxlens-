import React, { useState, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  Modal, FlatList, Platform, Alert, useColorScheme,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { D } from "./taxData";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true, shouldShowBanner: true, shouldShowList: true,
    shouldPlaySound: false, shouldSetBadge: false,
  }),
});

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

async function ensureReady() {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("reminders", {
      name: "Tax reminders",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  let p = await Notifications.getPermissionsAsync();
  if (p.status !== "granted") p = await Notifications.requestPermissionsAsync();
  return p.status === "granted";
}

function nextDates(r) {
  const out = [], now = new Date();
  if (r.type === "monthly") {
    for (let i = 0; i <= 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, r.day, 9, 0, 0);
      if (d > now) out.push(d);
    }
  } else {
    for (let i = 0; i < 5; i++) {
      const d = new Date(now.getFullYear() + i, r.month, r.day, 9, 0, 0);
      if (d > now) out.push(d);
    }
  }
  return out;
}

async function schedule(r, name) {
  const ids = [];
  for (const d of nextDates(r)) {
    const id = await Notifications.scheduleNotificationAsync({
      content: { title: "TaxLens reminder", body: (name ? name + ", " : "") + r.label },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: d, channelId: "reminders" },
    });
    ids.push(id);
  }
  return ids;
}

const Row = ({ c, label, value }) => (
  <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: c.bd }}>
    <Text style={{ color: c.tx, fontSize: 15, flex: 1 }}>{label}</Text>
    <Text style={{ color: c.tx, fontSize: 15, fontWeight: "600" }}>{value}</Text>
  </View>
);
const Card = ({ c, title, children }) => (
  <View style={{ backgroundColor: c.card, borderColor: c.bd, borderWidth: 1, borderRadius: 14, padding: 14, marginTop: 14 }}>
    <Text style={{ color: c.mut, fontSize: 13, marginBottom: 4 }}>{title}</Text>
    {children}
  </View>
);
const Field = ({ c, label, value, onChange, kb = "numeric" }) => (
  <View>
    <Text style={{ color: c.mut, fontSize: 13, marginTop: 12, marginBottom: 4 }}>{label}</Text>
    <TextInput
      value={value}
      onChangeText={onChange}
      keyboardType={kb}
      placeholderTextColor={c.mut}
      style={{ backgroundColor: c.card, color: c.tx, borderColor: c.bd, borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 16 }}
    />
  </View>
);
const Tab = ({ c, label, on, onPress }) => (
  <TouchableOpacity
    onPress={onPress}
    style={{ flex: 1, padding: 12, borderRadius: 10, alignItems: "center", borderWidth: 1, borderColor: on ? c.ac : c.bd, backgroundColor: on ? c.ac : c.card }}
  >
    <Text style={{ color: on ? c.on : c.tx, fontSize: 15, fontWeight: "600" }}>{label}</Text>
  </TouchableOpacity>
);
const Btn = ({ c, label, onPress }) => (
  <TouchableOpacity onPress={onPress} style={{ backgroundColor: c.ac, borderRadius: 10, padding: 14, alignItems: "center", marginTop: 16 }}>
    <Text style={{ color: c.on, fontSize: 16, fontWeight: "700" }}>{label}</Text>
  </TouchableOpacity>
);

export default function App() {
  const dark = useColorScheme() === "dark";
  const c = dark
    ? { bg: "#161615", card: "#222221", tx: "#efefea", mut: "#9a9a94", ac: "#5dcaa5", bd: "#363634", on: "#161615" }
    : { bg: "#f7f7f4", card: "#ffffff", tx: "#1d1d1b", mut: "#6b6b66", ac: "#0f6e56", bd: "#e2e2dc", on: "#ffffff" };

  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState(null);
  const [editing, setEditing] = useState(false);
  const [reminders, setReminders] = useState([]);
  const [nm, setNm] = useState("");
  const [key, setKey] = useState("US");
  const [inc, setInc] = useState("60000");
  const [full, setFull] = useState(false);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [pr, setPr] = useState("100");
  const [bp, setBp] = useState("100000");
  const [gn, setGn] = useState("10000");
  const [rtype, setRtype] = useState("monthly");
  const [rd, setRd] = useState("1");
  const [rm, setRm] = useState("1");
  const [rl, setRl] = useState("Time to review or pay your tax.");

  useEffect(() => {
    (async () => {
      try {
        const p = JSON.parse((await AsyncStorage.getItem("profile")) || "null");
        const rs = JSON.parse((await AsyncStorage.getItem("reminders")) || "[]");
        if (p) { setProfile(p); setNm(p.name); setKey(p.key); setInc(p.income); }
        if (rs.length && (await ensureReady())) {
          for (const r of rs) {
            for (const id of r.ids || []) await Notifications.cancelScheduledNotificationAsync(id);
            r.ids = await schedule(r, p ? p.name : "");
          }
          await AsyncStorage.setItem("reminders", JSON.stringify(rs));
        }
        setReminders(rs);
      } catch (e) {}
      setReady(true);
    })();
  }, []);

  const saveProfile = async () => {
    if (!nm.trim()) return Alert.alert("Please enter your name");
    const p = { name: nm.trim(), key, income: inc };
    await AsyncStorage.setItem("profile", JSON.stringify(p));
    setProfile(p);
    setEditing(false);
  };

  const addReminder = async () => {
    const day = parseInt(rd, 10), month = parseInt(rm, 10) - 1;
    if (!(day >= 1 && day <= 28)) return Alert.alert("Day must be between 1 and 28");
    if (rtype === "yearly" && !(month >= 0 && month <= 11)) return Alert.alert("Month must be 1 to 12");
    if (!(await ensureReady())) return Alert.alert("Please allow notifications for TaxLens in your phone settings");
    const r = { id: String(Date.now()), type: rtype, day, month: rtype === "yearly" ? month : 0, label: rl.trim() || "Time to review or pay your tax." };
    r.ids = await schedule(r, profile.name);
    const next = [...reminders, r];
    setReminders(next);
    await AsyncStorage.setItem("reminders", JSON.stringify(next));
  };

  const delReminder = async (r) => {
    for (const id of r.ids || []) await Notifications.cancelScheduledNotificationAsync(id);
    const next = reminders.filter((x) => x.id !== r.id);
    setReminders(next);
    await AsyncStorage.setItem("reminders", JSON.stringify(next));
  };

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

  const countryBtn = (
    <View>
      <Text style={{ color: c.mut, fontSize: 13, marginTop: 12, marginBottom: 4 }}>Country</Text>
      <TouchableOpacity onPress={() => setOpen(true)} style={{ backgroundColor: c.card, borderColor: c.bd, borderWidth: 1, borderRadius: 10, padding: 12 }}>
        <Text style={{ color: c.tx, fontSize: 16 }}>{d[0]} ({cur})  ▾</Text>
      </TouchableOpacity>
    </View>
  );

  const picker = (
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
  );

  if (!ready) return <View style={{ flex: 1, backgroundColor: c.bg }} />;

  if (!profile || editing) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: 48 }}>
        <StatusBar style={dark ? "light" : "dark"} />
        <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
          <Text style={{ color: c.tx, fontSize: 26, fontWeight: "700" }}>Welcome to TaxLens</Text>
          <Text style={{ color: c.mut, marginBottom: 8 }}>Set up your profile. It stays on this phone only.</Text>
          <Field c={c} label="Your name" value={nm} onChange={setNm} kb="default" />
          {countryBtn}
          <Field c={c} label="Yearly gross income" value={inc} onChange={setInc} />
          <Btn c={c} label="Continue" onPress={saveProfile} />
        </ScrollView>
        {picker}
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: 48 }}>
      <StatusBar style={dark ? "light" : "dark"} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ color: c.tx, fontSize: 26, fontWeight: "700" }}>Hi, {profile.name}</Text>
          <TouchableOpacity onPress={() => setEditing(true)}>
            <Text style={{ color: c.ac, fontSize: 15, fontWeight: "600" }}>Edit</Text>
          </TouchableOpacity>
        </View>
        <Text style={{ color: c.mut, marginBottom: 14 }}>Rough tax estimates for 30 countries</Text>

        <View style={{ flexDirection: "row", gap: 8 }}>
          <Tab c={c} label="Quick" on={!full} onPress={() => setFull(false)} />
          <Tab c={c} label="Full" on={full} onPress={() => setFull(true)} />
        </View>

        {countryBtn}
        <Field c={c} label="Yearly gross income" value={inc} onChange={setInc} />
        {full && <Field c={c} label="Purchase price (before VAT/sales tax)" value={pr} onChange={setPr} />}
        {full && <Field c={c} label="Business profit" value={bp} onChange={setBp} />}
        {full && <Field c={c} label="Investment gain" value={gn} onChange={setGn} />}

        <Card c={c} title="Take-home pay">
          <Text style={{ color: c.ac, fontSize: 28, fontWeight: "700", marginBottom: 4 }}>{f(income - tax - soc)}</Text>
          <Row c={c} label="Income tax" value={f(tax)} />
          <Row c={c} label="Social contributions" value={f(soc)} />
          <Row c={c} label="Effective total rate" value={income ? (((tax + soc) / income) * 100).toFixed(1) + "%" : "0%"} />
        </Card>

        {full && (
          <Card c={c} title="Other taxes">
            <Row c={c} label={"VAT / sales tax (" + d[3] + "%)"} value={f((price * d[3]) / 100)} />
            <Row c={c} label="Price with tax" value={f(price * (1 + d[3] / 100))} />
            <Row c={c} label={"Corporate tax (" + d[4] + "%)"} value={f((Math.max(n(bp), 0) * d[4]) / 100)} />
            <Row c={c} label={"Capital gains tax (" + d[5] + "%)"} value={f((Math.max(n(gn), 0) * d[5]) / 100)} />
          </Card>
        )}

        <Card c={c} title="Reminders">
          {reminders.length === 0 && <Text style={{ color: c.mut, fontSize: 14 }}>No reminders yet.</Text>}
          {reminders.map((r) => (
            <View key={r.id} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: c.bd }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: c.tx, fontSize: 15, fontWeight: "600" }}>
                  {r.type === "monthly" ? "Every month on day " + r.day : "Every year on " + MONTHS[r.month] + " " + r.day}
                </Text>
                <Text style={{ color: c.mut, fontSize: 13 }}>{r.label}</Text>
              </View>
              <TouchableOpacity onPress={() => delReminder(r)}>
                <Text style={{ color: "#d9534f", fontSize: 15, fontWeight: "600" }}>Delete</Text>
              </TouchableOpacity>
            </View>
          ))}
          <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
            <Tab c={c} label="Monthly" on={rtype === "monthly"} onPress={() => setRtype("monthly")} />
            <Tab c={c} label="Yearly" on={rtype === "yearly"} onPress={() => setRtype("yearly")} />
          </View>
          <Field c={c} label="Day of month (1 to 28)" value={rd} onChange={setRd} />
          {rtype === "yearly" && <Field c={c} label="Month (1 to 12)" value={rm} onChange={setRm} />}
          <Field c={c} label="Message" value={rl} onChange={setRl} kb="default" />
          <Btn c={c} label="Add reminder" onPress={addReminder} />
          <Text style={{ color: c.mut, fontSize: 12, marginTop: 10 }}>
            Reminders go off at 9:00 AM. You choose the dates yourself. TaxLens does not know your real tax deadlines, so check them with your local tax office.
          </Text>
        </Card>

        <Text style={{ color: c.mut, fontSize: 12, marginTop: 16 }}>
          Simplified: single filer, no deductions or credits, headline rates (about 2025). Regional, local and property taxes are not included. This is not tax advice.
        </Text>
      </ScrollView>
      {picker}
    </View>
  );
  }
