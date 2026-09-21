export type TestCase = {
  stdin: string;
  expected: string;
  hidden: boolean;
  label: string;
};

export type Question = {
  id: number;
  codename: string;
  title: string;
  subsystem: string;
  difficulty: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  points: number;
  statement: string;
  ioSpec: string;
  hint: string;
  brokenCode: string;
  tests: TestCase[];
};

export const TOTAL_POINTS = 100;
export const CONTEST_MINUTES = 90;

export const QUESTIONS: Question[] = [
  {
    id: 1,
    codename: "Q1",
    title: "The Silent Sensor",
    subsystem: "LM35 Temperature Acquisition Node",
    difficulty: "LOW",
    points: 5,
    statement:
      "The acquisition node reads five samples from an LM35 temperature sensor and reports their total. Since last night's firmware flash the node prints garbage — it is silent about the real readings. The values arrive fine on the serial line, so the fault is in the way the program captures and accumulates them.",
    ioSpec:
      "Input: 5 integers (sensor counts) separated by whitespace.\nOutput: a single line  SUM=<total>",
    hint: "How does scanf receive the address of a variable? And what is the value of an accumulator you never initialise?",
    brokenCode: `#include <stdio.h>

int main(void) {
    int x;
    int sum;
    int i;

    for (i = 0; i < 5; i++) {
        scanf("%d", x);
        sum = sum + x;
    }

    printf("SUM=%d\\n", sum);
    return 0;
}
`,
    tests: [
      { stdin: "10 20 30 40 50\n", expected: "SUM=150", hidden: false, label: "Nominal bench values" },
      { stdin: "0 0 0 0 0\n", expected: "SUM=0", hidden: false, label: "Sensor disconnected" },
      { stdin: "-5 12 7 -3 9\n", expected: "SUM=20", hidden: true, label: "Sub-zero chamber" },
      { stdin: "1023 1023 1023 1023 1023\n", expected: "SUM=5115", hidden: true, label: "Full-scale rail" },
    ],
  },
  {
    id: 2,
    codename: "Q2",
    title: "The Confused Controller",
    subsystem: "Oven Thermostat Decision Logic",
    difficulty: "LOW",
    points: 5,
    statement:
      "A process oven controller compares the current temperature against the setpoint and decides whether to HEAT, COOL, or HOLD. On the shop floor it heats when it should cool and never holds. Two classic C mistakes are hiding inside the comparison block.",
    ioSpec:
      "Input: two integers  current setpoint\nOutput: HEAT if current < setpoint, COOL if current > setpoint, HOLD if equal.",
    hint: "One equals sign assigns. Two equals signs compare. Also check which branch prints which action.",
    brokenCode: `#include <stdio.h>

int main(void) {
    int current, setpoint;
    scanf("%d %d", &current, &setpoint);

    if (current < setpoint) {
        printf("COOL\\n");
    } else if (current > setpoint) {
        printf("HEAT\\n");
    } else if (current = setpoint) {
        printf("HEAT\\n");
    }

    return 0;
}
`,
    tests: [
      { stdin: "150 200\n", expected: "HEAT", hidden: false, label: "Cold oven" },
      { stdin: "260 200\n", expected: "COOL", hidden: false, label: "Overshoot" },
      { stdin: "200 200\n", expected: "HOLD", hidden: true, label: "At setpoint" },
      { stdin: "-10 0\n", expected: "HEAT", hidden: true, label: "Freezer chamber" },
    ],
  },
  {
    id: 3,
    codename: "Q3",
    title: "The Reversed Alarm",
    subsystem: "Boiler Over-Pressure Annunciator",
    difficulty: "LOW",
    points: 5,
    statement:
      "The annunciator must raise ALARM when boiler pressure reaches 100 kPa or more, and report SAFE otherwise. During commissioning it screamed at atmospheric pressure and stayed quiet at 180 kPa. The logic is inverted and the boundary is wrong.",
    ioSpec: "Input: one integer pressure in kPa.\nOutput: ALARM or SAFE",
    hint: "Trace the comparison at exactly 100. Is >= the same as <?",
    brokenCode: `#include <stdio.h>

int main(void) {
    int pressure;
    scanf("%d", &pressure);

    if (pressure < 100) {
        printf("ALARM\\n");
    } else {
        printf("SAFE\\n");
    }

    return 0;
}
`,
    tests: [
      { stdin: "180\n", expected: "ALARM", hidden: false, label: "Over-pressure" },
      { stdin: "40\n", expected: "SAFE", hidden: false, label: "Normal running" },
      { stdin: "100\n", expected: "ALARM", hidden: true, label: "Exactly at trip point" },
      { stdin: "99\n", expected: "SAFE", hidden: true, label: "One below trip point" },
    ],
  },
  {
    id: 4,
    codename: "Q4",
    title: "The Broken Counter",
    subsystem: "Optical Encoder Pulse Counter",
    difficulty: "LOW",
    points: 5,
    statement:
      "An optical encoder feeds N amplitude samples. The counter must report how many samples strictly exceed a threshold. It reads one sample too many and crashes or reports a phantom pulse. Find the off-by-one.",
    ioSpec:
      "Input: first line N and threshold. Second line N integers.\nOutput: PULSES=<count> where count is the number of samples strictly greater than threshold.",
    hint: "An array of N elements has valid indices 0 .. N-1.",
    brokenCode: `#include <stdio.h>

int main(void) {
    int n, threshold;
    int sample[128];
    int i, count = 0;

    scanf("%d %d", &n, &threshold);

    for (i = 0; i <= n; i++) {
        scanf("%d", &sample[i]);
    }

    for (i = 0; i <= n; i++) {
        if (sample[i] >= threshold) {
            count++;
        }
    }

    printf("PULSES=%d\\n", count);
    return 0;
}
`,
    tests: [
      { stdin: "6 50\n10 60 50 70 49 80\n", expected: "PULSES=3", hidden: false, label: "Mixed train" },
      { stdin: "4 0\n0 0 0 0\n", expected: "PULSES=0", hidden: false, label: "Idle shaft" },
      { stdin: "5 -1\n-5 -2 0 3 -1\n", expected: "PULSES=2", hidden: true, label: "Negative bias" },
      { stdin: "1 9\n10\n", expected: "PULSES=1", hidden: true, label: "Single pulse" },
    ],
  },
  {
    id: 5,
    codename: "Q5",
    title: "The Temperature Panic",
    subsystem: "Multi-Zone Kiln Monitor",
    difficulty: "MEDIUM",
    points: 8,
    statement:
      "The kiln monitor scans N zone temperatures and reports the hottest and coldest zone. Whenever every zone is below zero it insists the minimum is 0 — the operator now believes the kiln is freezing solid. Fix the extremum tracking.",
    ioSpec:
      "Input: first line N. Second line N integers.\nOutput: a single line  MAX=<max> MIN=<min>",
    hint: "Never seed max/min with 0. Seed them with the first real reading.",
    brokenCode: `#include <stdio.h>

int main(void) {
    int n, i, t;
    int max = 0, min = 0;

    scanf("%d", &n);

    for (i = 0; i < n; i++) {
        scanf("%d", &t);
        if (t > max) {
            max = t;
        }
        if (t > min) {
            min = t;
        }
    }

    printf("MAX=%d MIN=%d\\n", max, min);
    return 0;
}
`,
    tests: [
      { stdin: "5\n120 340 90 500 210\n", expected: "MAX=500 MIN=90", hidden: false, label: "Normal kiln" },
      { stdin: "4\n-12 -40 -3 -25\n", expected: "MAX=-3 MIN=-40", hidden: false, label: "Cryo chamber" },
      { stdin: "1\n77\n", expected: "MAX=77 MIN=77", hidden: true, label: "Single zone" },
      { stdin: "6\n0 -1 5 5 -1 0\n", expected: "MAX=5 MIN=-1", hidden: true, label: "Zero crossing" },
    ],
  },
  {
    id: 6,
    codename: "Q6",
    title: "The Noisy Sensor",
    subsystem: "3-Point Moving Average Filter",
    difficulty: "MEDIUM",
    points: 8,
    statement:
      "A strain-gauge channel is noisy, so a 3-point moving average smooths it. The filter is supposed to print N-2 averaged values, one per line, each truncated to an integer. It currently walks off the end of the array and averages the wrong window.",
    ioSpec:
      "Input: first line N (N >= 3). Second line N integers.\nOutput: N-2 lines, each  AVG=<value> where value = (s[i] + s[i+1] + s[i+2]) / 3 using integer division.",
    hint: "The last valid window starts at index N-3. Check the divisor too.",
    brokenCode: `#include <stdio.h>

int main(void) {
    int n, i;
    int s[256];

    scanf("%d", &n);
    for (i = 0; i < n; i++) {
        scanf("%d", &s[i]);
    }

    for (i = 0; i < n; i++) {
        int avg = (s[i] + s[i + 1] + s[i + 2]) / 2;
        printf("AVG=%d\\n", avg);
    }

    return 0;
}
`,
    tests: [
      {
        stdin: "5\n3 6 9 12 15\n",
        expected: "AVG=6\nAVG=9\nAVG=12",
        hidden: false,
        label: "Linear ramp",
      },
      { stdin: "3\n1 1 1\n", expected: "AVG=1", hidden: false, label: "Flat line" },
      {
        stdin: "6\n10 0 20 0 30 0\n",
        expected: "AVG=10\nAVG=6\nAVG=16\nAVG=10",
        hidden: true,
        label: "Alternating noise",
      },
      { stdin: "4\n-3 -3 -3 -3\n", expected: "AVG=-3\nAVG=-3", hidden: true, label: "Negative offset" },
    ],
  },
  {
    id: 7,
    codename: "Q7",
    title: "The Drifting ADC",
    subsystem: "10-bit ADC to Millivolt Conversion",
    difficulty: "MEDIUM",
    points: 8,
    statement:
      "A 10-bit ADC (0..1023) on a 5.000 V reference must be converted to millivolts using mv = count * 5000 / 1023, truncated to an integer. The calibration technician reports every reading reads 0 mV or wildly low. The arithmetic is being done in the wrong order and the wrong type.",
    ioSpec:
      "Input: first line N. Second line N ADC counts.\nOutput: N lines, each  MV=<millivolts> (integer truncation).",
    hint: "count / 1023 in integer maths is 0 for almost every count. Multiply before you divide.",
    brokenCode: `#include <stdio.h>

int main(void) {
    int n, i, count;

    scanf("%d", &n);
    for (i = 0; i < n; i++) {
        scanf("%d", &count);
        int mv = (count / 1023) * 5000;
        printf("MV=%d\\n", mv);
    }

    return 0;
}
`,
    tests: [
      { stdin: "3\n0 512 1023\n", expected: "MV=0\nMV=2502\nMV=5000", hidden: false, label: "Calibration triad" },
      { stdin: "2\n100 205\n", expected: "MV=488\nMV=1001", hidden: false, label: "Low range" },
      { stdin: "4\n1 2 3 1022\n", expected: "MV=4\nMV=9\nMV=14\nMV=4995", hidden: true, label: "LSB resolution" },
      { stdin: "1\n767\n", expected: "MV=3748", hidden: true, label: "Three-quarter scale" },
    ],
  },
  {
    id: 8,
    codename: "Q8",
    title: "The Stuck Relay",
    subsystem: "Latching Relay Command Interpreter",
    difficulty: "MEDIUM",
    points: 8,
    statement:
      "A latching relay accepts a command string: 'T' toggles the coil, '1' forces it ON, '0' forces it OFF, any other character is ignored. The relay starts OFF. On the rig the relay latches ON and never releases — the toggle is written as an assignment.",
    ioSpec:
      "Input: one line containing the command string (no spaces).\nOutput: a single line  RELAY=ON or RELAY=OFF",
    hint: "state = 1 is not the same as state = !state. Also make sure '0' is handled.",
    brokenCode: `#include <stdio.h>
#include <string.h>

int main(void) {
    char cmd[256];
    int state = 0;
    int i;

    scanf("%255s", cmd);

    for (i = 0; i < strlen(cmd); i++) {
        if (cmd[i] == 'T') {
            state = 1;
        } else if (cmd[i] == '1') {
            state = 1;
        }
    }

    printf("RELAY=%s\\n", state ? "ON" : "OFF");
    return 0;
}
`,
    tests: [
      { stdin: "TT\n", expected: "RELAY=OFF", hidden: false, label: "Double toggle" },
      { stdin: "T1T\n", expected: "RELAY=OFF", hidden: false, label: "Force then toggle" },
      { stdin: "10T\n", expected: "RELAY=ON", hidden: true, label: "Force off then toggle" },
      { stdin: "xTxTxT\n", expected: "RELAY=ON", hidden: true, label: "Noise characters" },
      { stdin: "0\n", expected: "RELAY=OFF", hidden: true, label: "Explicit release" },
    ],
  },
  {
    id: 9,
    codename: "Q9",
    title: "The Unstable Alarm",
    subsystem: "RS-485 Frame Checksum & Alarm Validator",
    difficulty: "MEDIUM",
    points: 8,
    statement:
      "Telemetry frames arrive over RS-485 as N data bytes followed by a transmitted checksum. A frame is valid when (sum of data bytes) modulo 256 equals the transmitted checksum. The validator rejects good frames: the modulus is wrong and the comparison uses the raw sum.",
    ioSpec:
      "Input: first line N. Second line N byte values (0..255). Third line the transmitted checksum.\nOutput: FRAME=PASS or FRAME=FAIL",
    hint: "A byte wraps at 256, not 255. Compare the wrapped value, not the raw sum.",
    brokenCode: `#include <stdio.h>

int main(void) {
    int n, i, b, sum = 0, tx;

    scanf("%d", &n);
    for (i = 0; i < n; i++) {
        scanf("%d", &b);
        sum += b;
    }
    scanf("%d", &tx);

    int checksum = sum % 255;

    if (sum == tx) {
        printf("FRAME=PASS\\n");
    } else {
        printf("FRAME=FAIL\\n");
    }

    return 0;
}
`,
    tests: [
      { stdin: "3\n10 20 30\n60\n", expected: "FRAME=PASS", hidden: false, label: "Short clean frame" },
      { stdin: "4\n200 100 50 10\n104\n", expected: "FRAME=PASS", hidden: false, label: "Wrapped checksum" },
      { stdin: "4\n200 100 50 10\n60\n", expected: "FRAME=FAIL", hidden: true, label: "Corrupted checksum" },
      { stdin: "2\n255 1\n0\n", expected: "FRAME=PASS", hidden: true, label: "Exact wrap to zero" },
      { stdin: "1\n0\n0\n", expected: "FRAME=PASS", hidden: true, label: "Empty payload byte" },
    ],
  },
  {
    id: 10,
    codename: "Q10",
    title: "The Runaway Motor",
    subsystem: "PWM Duty Clamp for DC Motor Driver",
    difficulty: "HIGH",
    points: 10,
    statement:
      "A speed loop produces raw duty requests that must be clamped into the 8-bit PWM range 0..255 before reaching the H-bridge. Negative requests currently pass straight through, wrap around in the driver register, and the motor runs away at full speed. Clamp both ends.",
    ioSpec:
      "Input: first line N. Second line N integers (raw duty requests).\nOutput: N lines, each  DUTY=<clamped value>",
    hint: "A clamp needs a lower bound as well as an upper bound.",
    brokenCode: `#include <stdio.h>

int main(void) {
    int n, i, duty;

    scanf("%d", &n);
    for (i = 0; i < n; i++) {
        scanf("%d", &duty);
        if (duty > 255) {
            duty = 255;
        }
        printf("DUTY=%d\\n", duty);
    }

    return 0;
}
`,
    tests: [
      {
        stdin: "4\n-40 0 128 900\n",
        expected: "DUTY=0\nDUTY=0\nDUTY=128\nDUTY=255",
        hidden: false,
        label: "Full sweep",
      },
      { stdin: "2\n255 256\n", expected: "DUTY=255\nDUTY=255", hidden: false, label: "Upper boundary" },
      { stdin: "3\n-1 -1000 1\n", expected: "DUTY=0\nDUTY=0\nDUTY=1", hidden: true, label: "Reverse request" },
      { stdin: "1\n77\n", expected: "DUTY=77", hidden: true, label: "Mid scale" },
    ],
  },
  {
    id: 11,
    codename: "Q11",
    title: "Factory Shutdown",
    subsystem: "Data Logger Integrity & Shutdown Report",
    difficulty: "HIGH",
    points: 10,
    statement:
      "An SD-card data logger writes N records of the form  <channel_id> <value>. Records with a negative value are corrupt and must be discarded. The report must print how many records survived and the mean of the surviving values to exactly two decimal places. Today the mean is always too small — the divisor counts the corrupt records too, and integer division destroys the fraction.",
    ioSpec:
      "Input: first line N. Then N lines, each  <channel_id> <value>.\nOutput: two lines\nVALID=<count>\nMEAN=<mean to 2 decimals>\nIf no record survives, print MEAN=0.00",
    hint: "Divide by the count of valid records, in floating point. Watch the zero-valid case.",
    brokenCode: `#include <stdio.h>

int main(void) {
    int n, i, id, value;
    int sum = 0, valid = 0;

    scanf("%d", &n);
    for (i = 0; i < n; i++) {
        scanf("%d %d", &id, &value);
        if (value > 0) {
            sum += value;
            valid++;
        }
    }

    int mean = sum / n;

    printf("VALID=%d\\n", valid);
    printf("MEAN=%d\\n", mean);
    return 0;
}
`,
    tests: [
      {
        stdin: "5\n1 10\n2 -3\n3 25\n4 -1\n5 40\n",
        expected: "VALID=3\nMEAN=25.00",
        hidden: false,
        label: "Partially corrupt log",
      },
      {
        stdin: "3\n1 1\n2 2\n3 2\n",
        expected: "VALID=3\nMEAN=1.67",
        hidden: false,
        label: "Rounding check",
      },
      { stdin: "2\n1 -5\n2 -9\n", expected: "VALID=0\nMEAN=0.00", hidden: true, label: "Total corruption" },
      {
        stdin: "4\n1 0\n2 0\n3 7\n4 -2\n",
        expected: "VALID=3\nMEAN=2.33",
        hidden: true,
        label: "Zero is a valid reading",
      },
    ],
  },
  {
    id: 12,
    codename: "Q12",
    title: "SYSTEM FAILURE",
    subsystem: "Master Plant Supervisory Report",
    difficulty: "CRITICAL",
    points: 20,
    statement:
      "The supervisory layer is down and every subsystem depends on it. It ingests N raw sensor samples, rejects any sample outside the valid window 0..1000 inclusive, then reports: the number of accepted samples, their mean to two decimals, and how many accepted samples are alarm-level (strictly greater than 800). Finally it prints the plant verdict: STATUS=RECOVERED when there are no alarm samples and at least one accepted sample, otherwise STATUS=CRITICAL. The current build has several independent defects across bounds, counting, division and verdict logic.",
    ioSpec:
      "Input: first line N. Second line N integers.\nOutput: exactly four lines\nACCEPTED=<count>\nMEAN=<mean to 2 decimals, 0.00 when none accepted>\nALARMS=<count>\nSTATUS=RECOVERED or STATUS=CRITICAL",
    hint: "Check the inclusive bounds, the alarm comparison, the divisor, the floating point format, and the verdict condition — all of them.",
    brokenCode: `#include <stdio.h>

int main(void) {
    int n, i, v;
    int accepted = 0, alarms = 0;
    int sum = 0;

    scanf("%d", &n);
    for (i = 0; i < n; i++) {
        scanf("%d", &v);
        if (v > 0 && v < 1000) {
            accepted++;
            sum += v;
            if (v >= 800) {
                alarms++;
            }
        }
    }

    int mean = sum / n;

    printf("ACCEPTED=%d\\n", accepted);
    printf("MEAN=%d\\n", mean);
    printf("ALARMS=%d\\n", alarms);

    if (alarms > 0) {
        printf("STATUS=RECOVERED\\n");
    } else {
        printf("STATUS=CRITICAL\\n");
    }

    return 0;
}
`,
    tests: [
      {
        stdin: "6\n100 200 300 -5 1200 400\n",
        expected: "ACCEPTED=4\nMEAN=250.00\nALARMS=0\nSTATUS=RECOVERED",
        hidden: false,
        label: "Mixed plant scan",
      },
      {
        stdin: "5\n0 1000 800 801 -1\n",
        expected: "ACCEPTED=4\nMEAN=650.25\nALARMS=2\nSTATUS=CRITICAL",
        hidden: false,
        label: "Inclusive bounds and alarm edge",
      },
      {
        stdin: "3\n-4 2000 -9\n",
        expected: "ACCEPTED=0\nMEAN=0.00\nALARMS=0\nSTATUS=CRITICAL",
        hidden: true,
        label: "All samples rejected",
      },
      {
        stdin: "4\n800 800 800 800\n",
        expected: "ACCEPTED=4\nMEAN=800.00\nALARMS=0\nSTATUS=RECOVERED",
        hidden: true,
        label: "Exactly at alarm threshold",
      },
      {
        stdin: "1\n1000\n",
        expected: "ACCEPTED=1\nMEAN=1000.00\nALARMS=1\nSTATUS=CRITICAL",
        hidden: true,
        label: "Single full-scale alarm",
      },
    ],
  },
];

export function getQuestion(id: number): Question | undefined {
  return QUESTIONS.find((q) => q.id === id);
}

export const DIFFICULTY_COLOR: Record<Question["difficulty"], string> = {
  LOW: "text-status-ok",
  MEDIUM: "text-status-warn",
  HIGH: "text-status-warn",
  CRITICAL: "text-status-fail",
};
