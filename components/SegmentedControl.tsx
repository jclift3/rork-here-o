import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Colors from '@/constants/colors';

interface SegmentedControlProps {
  segments: string[];
  selectedIndex: number;
  onChange: (index: number) => void;
  variant?: 'primary' | 'hero';
}

const SegmentedControl: React.FC<SegmentedControlProps> = ({
  segments,
  selectedIndex,
  onChange,
  variant = 'primary',
}) => {
  const getBackgroundColor = () => {
    return variant === 'hero' ? Colors.heroPrimary : Colors.primary;
  };

  return (
    <View style={styles.container}>
      {segments.map((segment, index) => (
        <TouchableOpacity
          key={index}
          style={[
            styles.segment,
            selectedIndex === index && [
              styles.selectedSegment,
              { backgroundColor: getBackgroundColor() },
            ],
          ]}
          onPress={() => onChange(index)}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.segmentText,
              selectedIndex === index && styles.selectedSegmentText,
            ]}
          >
            {segment}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: Colors.gray[200],
    borderRadius: 12,
    padding: 4,
  },
  segment: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  selectedSegment: {
    backgroundColor: Colors.primary,
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.gray[700],
  },
  selectedSegmentText: {
    color: Colors.white,
    fontWeight: '600',
  },
});

export default SegmentedControl;