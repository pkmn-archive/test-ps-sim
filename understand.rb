#!/usr/bin/ruby

types = {}
ARGF.each_line do |line|
  type, word = line.chomp.split(',')
  types[type] = (types[type] || 0) + 1
end

types.sort_by{|k,v| v}.each do |k, v|
  puts "#{v} #{k}"
end

